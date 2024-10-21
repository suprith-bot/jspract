// Function to load tasks from the backend
async function loadTasks() {
    try {
      const response = await fetch('/api/tasks');
      if (!response.ok) throw new Error('Failed to fetch tasks');
      const tasks = await response.json();
      displayTasks(tasks);
    } catch (error) {
      alert(error.message);
    }
  }
  
  // Function to display tasks in the DOM
  function displayTasks(tasks) {
    const taskList = document.getElementById('task-list');
    taskList.innerHTML = '<h2>Your Tasks</h2>'; // Reset task list
  
    if (tasks.length === 0) {
      taskList.innerHTML += '<p>No tasks available. Add a new task!</p>';
      return;
    }
  
    tasks.forEach(task => {
      const taskItem = document.createElement('div');
      taskItem.classList.add('task-item');
  
      // Task Details
      const taskDetails = document.createElement('div');
      taskDetails.classList.add('task-details');
  
      const taskTitle = document.createElement('h3');
      taskTitle.textContent = task.title;
      taskDetails.appendChild(taskTitle);
  
      const taskDesc = document.createElement('p');
      taskDesc.textContent = task.description;
      taskDetails.appendChild(taskDesc);
  
      const taskPriority = document.createElement('p');
      taskPriority.textContent = `Priority: ${task.priority}`;
      taskDetails.appendChild(taskPriority);
  
      const taskStatus = document.createElement('p');
      taskStatus.textContent = `Status: ${task.status}`;
      taskDetails.appendChild(taskStatus);
  
      taskItem.appendChild(taskDetails);
  
      // Task Actions
      const taskActions = document.createElement('div');
      taskActions.classList.add('task-actions');
  
      // Complete Button
      if (task.status !== 'Completed') {
        const completeBtn = document.createElement('button');
        completeBtn.textContent = 'Complete';
        completeBtn.classList.add('complete-btn');
        completeBtn.onclick = () => markAsComplete(task.id);
        taskActions.appendChild(completeBtn);
      }
  
      // Edit Button
      const editBtn = document.createElement('button');
      editBtn.textContent = 'Edit';
      editBtn.classList.add('edit-btn');
      editBtn.onclick = () => openEditModal(task);
      taskActions.appendChild(editBtn);
  
      // Delete Button
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = 'Delete';
      deleteBtn.classList.add('delete-btn');
      deleteBtn.onclick = () => deleteTask(task.id);
      taskActions.appendChild(deleteBtn);
  
      taskItem.appendChild(taskActions);
  
      taskList.appendChild(taskItem);
    });
  }
  
  // Function to handle task creation
  document.getElementById('task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const title = document.getElementById('task-title').value.trim();
    const description = document.getElementById('task-desc').value.trim();
    const priority = document.getElementById('task-priority').value;
  
    if (!title) {
      alert('Task title is required.');
      return;
    }
  
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, priority })
      });
  
      if (!response.ok) throw new Error('Failed to add task');
  
      const newTask = await response.json();
      alert('Task added successfully!');
      document.getElementById('task-form').reset();
      loadTasks();
    } catch (error) {
      alert(error.message);
    }
  });
  
  // Function to delete a task
  async function deleteTask(id) {
    if (!confirm('Are you sure you want to delete this task?')) return;
  
    try {
      const response = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete task');
      alert('Task deleted successfully!');
      loadTasks();
    } catch (error) {
      alert(error.message);
    }
  }
  
  // Function to mark a task as complete
  async function markAsComplete(id) {
    try {
      const response = await fetch(`/api/tasks/${id}/complete`, { method: 'PUT' });
      if (!response.ok) throw new Error('Failed to mark task as complete');
      alert('Task marked as complete!');
      loadTasks();
    } catch (error) {
      alert(error.message);
    }
  }
  
  // Function to open the edit task modal
  function openEditModal(task) {
    const modal = document.getElementById('edit-modal');
    modal.style.display = 'block';
  
    document.getElementById('edit-task-id').value = task.id;
    document.getElementById('edit-task-title').value = task.title;
    document.getElementById('edit-task-desc').value = task.description;
    document.getElementById('edit-task-priority').value = task.priority;
  }
  
  // Function to close the edit task modal
  document.getElementById('close-modal').addEventListener('click', () => {
    document.getElementById('edit-modal').style.display = 'none';
  });
  
  // Function to handle task editing
  document.getElementById('edit-task-form').addEventListener('submit', async (e) => {
    e.preventDefault();
  
    const id = document.getElementById('edit-task-id').value;
    const title = document.getElementById('edit-task-title').value.trim();
    const description = document.getElementById('edit-task-desc').value.trim();
    const priority = document.getElementById('edit-task-priority').value;
  
    if (!title) {
      alert('Task title is required.');
      return;
    }
  
    try {
      const response = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, priority })
      });
  
      if (!response.ok) throw new Error('Failed to update task');
  
      alert('Task updated successfully!');
      document.getElementById('edit-modal').style.display = 'none';
      loadTasks();
    } catch (error) {
      alert(error.message);
    }
  });
  
  // Close modal when clicking outside of it
  window.onclick = function(event) {
    const modal = document.getElementById('edit-modal');
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  };
  
  // Initial loading of tasks
  document.addEventListener('DOMContentLoaded', loadTasks);
  