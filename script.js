// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const database = firebase.database();

// --- Main Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;

    if (path.includes('login.html')) {
        handleLoginPage();
    } else {
        handleDashboardPage();
    }

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            if (path.includes('login.html')) {
                window.location.replace('index.html');
            }
        } else {
            if (!path.includes('login.html')) {
                window.location.replace('login.html');
            }
        }
    });
});

function handleLoginPage() {
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            firebase.auth().signInWithEmailAndPassword(email, password)
                .then((userCredential) => {
                    // User signed in, now check their role.
                    const user = userCredential.user;
                    const userRef = firebase.database().ref('users/' + user.uid);
                    userRef.once('value', (snapshot) => {
                        const userData = snapshot.val();
                        if (userData && userData.role === 'technician') {
                            // Role is technician, allow login
                            window.location.href = 'index.html';
                        } else {
                            // Not a technician, or no role data
                            errorMessage.textContent = 'Access denied. Only technicians can log in.';
                            firebase.auth().signOut(); // Sign them out
                        }
                    });
                })
                .catch((error) => {
                    errorMessage.textContent = error.message;
                });
        });
    }
}

function handleDashboardPage() {
    const logoutBtn = document.getElementById('logout-btn');
    const tasksContainer = document.getElementById('tasks-container');
    const modal = document.getElementById('update-modal');
    const closeBtn = document.querySelector('.close-btn');
    const updateForm = document.getElementById('update-form');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            firebase.auth().signOut().then(() => {
                window.location.href = 'login.html';
            });
        });
    }

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            loadTasks(user.uid, tasksContainer);
        }
    });

    if(closeBtn) {
        closeBtn.onclick = function() {
            modal.style.display = "none";
        }
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }

    if(updateForm){
        updateForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const reportId = document.getElementById('report-id').value;
            const status = document.getElementById('status').value;
            updateTaskStatus(reportId, status);
        });
    }
}

function loadTasks(technicianId, container) {
    const reportsRef = firebase.database().ref('reports');
    const usersRef = firebase.database().ref('users');

    usersRef.child(technicianId).once('value', (userSnapshot) => {
        const technicianName = userSnapshot.val().name;

        reportsRef.on('value', (snapshot) => {
            container.innerHTML = '';
            const reports = snapshot.val();
            if (reports) {
                let tasksFound = false;
                Object.keys(reports).forEach(key => {
                    const report = reports[key];
                    // Temporary workaround: Check against name OR ID.
                    if (report.assignedTo === technicianId || report.assignedTo === technicianName) {
                        tasksFound = true;
                        const taskElement = document.createElement('tr');
                        taskElement.innerHTML = `
                            <td>${report.category}</td>
                            <td>${report.location}</td>
                            <td>${report.description}</td>
                            <td><span class="status ${report.status.toLowerCase().replace(' ', '-')}">${report.status}</span></td>
                            <td>${new Date(report.submittedAt).toLocaleString()}</td>
                            <td><button class="update-btn" data-id="${key}">Update</button></td>
                        `;
                        container.appendChild(taskElement);
                    }
                });

                if (tasksFound) {
                    document.querySelectorAll('.update-btn').forEach(button => {
                        button.addEventListener('click', (e) => {
                            const reportId = e.target.getAttribute('data-id');
                            openUpdateModal(reportId);
                        });
                    });
                } else {
                    container.innerHTML = '<tr><td colspan="6">No tasks assigned.</td></tr>';
                }
            } else {
                container.innerHTML = '<tr><td colspan="6">No tasks assigned.</td></tr>';
            }
        });
    });
}

function openUpdateModal(reportId) {
    const modal = document.getElementById('update-modal');
    document.getElementById('report-id').value = reportId;

    const reportRef = firebase.database().ref(`reports/${reportId}`);
    reportRef.once('value', (snapshot) => {
        const report = snapshot.val();
        const taskDetails = document.getElementById('task-details');
        taskDetails.innerHTML = `
            <p><strong>Category:</strong> ${report.category}</p>
            <p><strong>Location:</strong> ${report.location}</p>
            <p><strong>Description:</strong> ${report.description}</p>
            <p><strong>Current Status:</strong> ${report.status}</p>
        `;
        document.getElementById('status').value = report.status;
    });

    modal.style.display = 'flex';
}

function updateTaskStatus(reportId, status) {
    const reportRef = firebase.database().ref(`reports/${reportId}`);
    reportRef.update({
        status: status,
        updatedAt: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        document.getElementById('update-modal').style.display = 'none';
    }).catch(error => {
        console.error("Error updating status: ", error);
    });
}
