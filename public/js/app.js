// /public/js/app.js

// Function to check authentication
const checkAuth = () => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must be logged in to view this page.');
    window.location.href = '/login.html';
  }else{
    console.log("hi");
    
  }
};
function test(){
  console.log('hi');
  
}

// Logout function
const logout = () => {
  localStorage.removeItem('token');
  window.location.href = '/login.html';
};

// Attach logout event
document.getElementById('logout-btn').addEventListener('click', logout);

// Function to load tasks from the backend
const loadTasks = async () => {
  const token = localStorage.getItem('token');
  if (!token) return;

  try {
    const response = await fetch('/api/tasks', {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      const errorData = await response.json();
      alert(errorData.error || 'Failed to fetch tasks.');
      return;
    }

    const tasks = await response.json();
    displayTasks(tasks);
  } catch (error) {
    console.error('Load Tasks Error:', error);
    alert('An error occurred while loading tasks.');
  }
};

// Function to display tasks in the UI
const displayTasks = (tasks) => {
  const taskList = document.getElementById('task-list');
  if (tasks.length === 0) {
    taskList.innerHTML = '<p>No tasks found. Add a new task!</p>';
    return;
  }

  taskList.innerHTML = tasks.map(task => `
    <div class="task-item">
      <div>
        <h3>${task.title}</h3>
        <p>${task.description}</p>
        <p>Priority: ${task.priority}</p>
        <p>Status: ${task.status}</p>
      </div>
      <div>
        ${task.status !== 'Completed' ? `<button class="complete-btn" onclick="markAsComplete(${task.id})">Complete</button>` : ''}
        <button class="edit-btn" onclick="editTask(${task.id}, '${escapeHtml(task.title)}', '${escapeHtml(task.description)}', '${task.priority}')">Edit</button>
        <button onclick="deleteTask(${task.id})">Delete</button>
      </div>
    </div>
  `).join('');
};

// Escape HTML to prevent XSS
const escapeHtml = (unsafe) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

// Function to handle task creation
document.getElementById('task-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('task-title').value.trim();
  const description = document.getElementById('task-desc').value.trim();
  const priority = document.getElementById('task-priority').value;

  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must be logged in to add tasks.');
    window.location.href = '/login.html';
    return;
  }

  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ title, description, priority }),
    });

    const data = await response.json();

    if (response.ok) {
      alert('Task added successfully!');
      document.getElementById('task-form').reset();
      loadTasks();
    } else {
      alert(data.error || 'Failed to add task.');
    }
  } catch (error) {
    console.error('Add Task Error:', error);
    alert('An error occurred while adding the task.');
  }
});

// Function to handle task deletion
const deleteTask = async (id) => {
  const confirmDelete = confirm('Are you sure you want to delete this task?');
  if (!confirmDelete) return;

  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must be logged in to delete tasks.');
    window.location.href = '/login.html';
    return;
  }

  try {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await response.json();

    if (response.ok) {
      alert(data.message || 'Task deleted successfully!');
      loadTasks();
    } else {
      alert(data.error || 'Failed to delete task.');
    }
  } catch (error) {
    console.error('Delete Task Error:', error);
    alert('An error occurred while deleting the task.');
  }
};

// Function to mark a task as complete
const markAsComplete = async (id) => {
  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must be logged in to update tasks.');
    window.location.href = '/login.html';
    return;
  }

  try {
    const response = await fetch(`/api/tasks/${id}/complete`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    const data = await response.json();

    if (response.ok) {
      alert('Task marked as complete!');
      loadTasks();
    } else {
      alert(data.error || 'Failed to mark task as complete.');
    }
  } catch (error) {
    console.error('Mark Task Complete Error:', error);
    alert('An error occurred while updating the task.');
  }
};

// Function to handle task editing
const editTask = async (id, currentTitle, currentDescription, currentPriority) => {
  const newTitle = prompt('Edit Task Title:', currentTitle);
  if (newTitle === null) return; // Cancelled

  const newDescription = prompt('Edit Task Description:', currentDescription);
  if (newDescription === null) return; // Cancelled

  const newPriority = prompt('Edit Task Priority (Low, Medium, High):', currentPriority);
  if (newPriority === null) return; // Cancelled

  // Validate priority
  if (!['Low', 'Medium', 'High'].includes(newPriority)) {
    alert('Invalid priority value.');
    return;
  }

  const token = localStorage.getItem('token');
  if (!token) {
    alert('You must be logged in to update tasks.');
    window.location.href = '/login.html';
    return;
  }

  try {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ title: newTitle.trim(), description: newDescription.trim(), priority: newPriority }),
    });

    const data = await response.json();

    if (response.ok) {
      alert('Task updated successfully!');
      loadTasks();
    } else {
      alert(data.error || 'Failed to update task.');
    }
  } catch (error) {
    console.error('Edit Task Error:', error);
    alert('An error occurred while updating the task.');
  }
};

// Initial setup
document.addEventListener('DOMContentLoaded', async () => {
  
test();
  checkAuth();
  loadTasks();
});
