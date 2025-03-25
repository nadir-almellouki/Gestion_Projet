// VARIABLES GLOBALES
let draggedTask = null;
let taskCounter = 7; // Commence à 7 car il y a déjà 6 tâches existantes
let currentTaskColumn = null;
let temporaryComments = []; // Stocker les commentaires avant la création de la tâche

// INITIALISATION
document.addEventListener('DOMContentLoaded', async function() {
    console.log('DOM chargé - initialisation');
    
    // Initialiser le sélecteur de vue
    const viewSelector = document.getElementById('viewSelector');
    if (viewSelector) {
        viewSelector.value = 'liste';
        viewSelector.addEventListener('change', function() {
            if (this.value === 'colonne') {
                window.location.href = 'index.php';
            }
        });
    }

    // Charger les tâches
    await loadTasks();
    setupTaskEditing();
    
    // Initialiser les autres fonctionnalités
    initializeSearch();
    initializeAddTaskButtons();
    setupTaskEditing();
    setInterval(updateAllTaskTimers, 60000);
});

// FONCTIONS DE CHARGEMENT
async function loadTasks() {
    try {
        const tasks = await loadTasksFromDB();
        const taskListContainer = document.getElementById('task-list-container');
        
        if (!taskListContainer) {
            console.error('Conteneur des tâches introuvable');
            return;
        }

        taskListContainer.innerHTML = '';

        tasks.forEach(task => {
            const taskElement = createTaskElement(task);
            taskListContainer.appendChild(taskElement);
        });
    } catch (error) {
        console.error('Erreur chargement tâches:', error);
    }
}

async function loadTasksFromDB() {
    try {
        const response = await fetch('api/tasks.php', {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Tâches chargées:', data);
        return data;
    } catch (error) {
        console.error('Erreur lors du chargement depuis la DB:', error);
        return [];
    }
}

function createTaskElement(task) {
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    taskElement.id = 'task-' + task.id;
    
    // Gestion des dates invalides
    const hasValidDate = task.deadline_date && task.deadline_date !== '0000-00-00';
    taskElement.dataset.deadlineDate = hasValidDate ? task.deadline_date : '';
    taskElement.dataset.deadlineTime = task.deadline_time || '23:59';
    taskElement.dataset.comments = JSON.stringify(task.comments || []);
    
    // Formater la date si elle existe
    const deadline = hasValidDate 
        ? new Date(task.deadline_date + 'T' + (task.deadline_time || '23:59')).toLocaleString('fr-FR')
        : 'Pas de date limite';
    
    taskElement.innerHTML = `
        <div class="task-header">
            <h5>${task.title}</h5>
            <span class="task-status">${task.status}</span>
        </div>
        <div class="task-description">
            <p>${task.description || ''}</p>
        </div>
        <div class="task-footer">
            <span class="deadline">${deadline}</span>
            <span class="comments-count">${task.comments ? task.comments.length : 0} commentaires</span>
        </div>
    `;
    
    return taskElement;
}
// FONCTIONS DE RECHERCHE
function initializeSearch() {
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('searchInput');
    
    if (searchForm) {
        searchForm.addEventListener('submit', searchTasks);
    }
    
    if (searchInput) {
        // Recherche en temps réel avec délai
        searchInput.addEventListener('input', function() {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(searchTasks, 300);
        });
        
        // Bouton de réinitialisation de recherche
        const clearButton = document.querySelector('.search-clear');
        if (clearButton) {
            clearButton.addEventListener('click', function() {
                searchInput.value = '';
                resetSearch();
            });
        }
    }
}

function searchTasks(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }
    
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const searchQuery = searchInput.value.trim().toLowerCase();
    
    if (searchQuery === '') {
        resetSearch();
        return;
    }
    
    const tasks = document.querySelectorAll('.task');
    let visibleTasksCount = 0;
    
    tasks.forEach(task => {
        const taskTitle = task.querySelector('h5')?.textContent.toLowerCase() || '';
        const taskDescription = task.querySelector('.my-2 p')?.textContent.toLowerCase() || '';
        const taskDeadline = task.querySelector('.TaskHead p')?.textContent.toLowerCase() || '';
        const taskContent = `${taskTitle} ${taskDescription} ${taskDeadline}`;
        
        if (taskContent.includes(searchQuery)) {
            task.style.display = 'block';
            task.classList.add('search-highlight');
            visibleTasksCount++;
        } else {
            task.style.display = 'none';
            task.classList.remove('search-highlight');
        }
    });
    
    // Gestion du message "aucun résultat"
    handleNoResultsMessage(visibleTasksCount, searchQuery);
}

function handleNoResultsMessage(visibleCount, query) {
    let noResultsMsg = document.getElementById('noResultsMessage');
    const shouldShowMessage = visibleCount === 0 && query !== '';
    
    if (shouldShowMessage) {
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.id = 'noResultsMessage';
            noResultsMsg.className = 'alert alert-info mt-3';
            noResultsMsg.textContent = 'Aucune tâche ne correspond à votre recherche.';
            document.querySelector('.search-container').appendChild(noResultsMsg);
        } else {
            noResultsMsg.style.display = 'block';
        }
    } else if (noResultsMsg) {
        noResultsMsg.style.display = 'none';
    }
}

function resetSearch() {
    const tasks = document.querySelectorAll('.task');
    tasks.forEach(task => {
        task.style.display = 'block';
        task.classList.remove('search-highlight');
    });
    
    const noResultsMsg = document.getElementById('noResultsMessage');
    if (noResultsMsg) {
        noResultsMsg.style.display = 'none';
    }
}

// FONCTIONS DE GESTION DES TÂCHES
function initializeAddTaskButtons() {
    document.querySelectorAll('.add-task-btn').forEach(button => {
        button.addEventListener('click', function() {
            currentTaskColumn = this.closest('.task-container');
            loadPopup('./popup.html', 'Ajouter une tâche', null, addPopupEventListeners);
        });
    });
}

function setupTaskEditing() {
    document.addEventListener('click', function(event) {
        const taskElement = event.target.closest('.task-item');
        
        if (taskElement && 
            !event.target.closest('.move-up') && 
            !event.target.closest('.move-down') && 
            !event.target.closest('.delete-task')) {
            
            // Récupérer les données de la tâche
            const taskData = {
                title: taskElement.querySelector('h5').textContent,
                description: taskElement.querySelector('.task-description p').textContent,
                deadlineDate: taskElement.dataset.deadlineDate || '',
                deadlineTime: taskElement.dataset.deadlineTime || '23:59',
                comments: JSON.parse(taskElement.dataset.comments || '[]')
            };
            
            // Stocker la référence à la tâche en cours d'édition
            window.taskBeingEdited = taskElement;
            
            showTaskPopup('Modifier la tâche', taskElement);
        }
    });
}

function createNewTask(title, description, commentText, deadlineDate, deadlineTime) {
    if (!currentTaskColumn) {
        console.error("Impossible de déterminer la colonne pour la nouvelle tâche");
        return;
    }

    taskCounter++;

    // Créer une nouvelle tâche
    const newTask = document.createElement('div');
    newTask.className = 'task mt-4 p-3 rounded-4';
    newTask.draggable = true;
    newTask.id = 'task' + taskCounter;
    newTask.setAttribute('ondragstart', 'drag(event)');

    // Calculer le temps restant en minutes
    const timeLeftText = calculateTimeLeft(deadlineDate, deadlineTime);

    // Déterminer le nombre de commentaires
    const commentCount = temporaryComments.length + (commentText && commentText.trim() !== '' ? 1 : 0);

    newTask.innerHTML = `
        <div class="TaskHead d-flex justify-content-between">
            <h5 class="mb-0">${title}</h5>
            <p class="mb-0"><i class="fa-regular fa-clock me-1"></i>${timeLeftText}</p>
        </div>
        <div class="my-2">
            <p class="mb-1">${description}</p>
        </div>
        <div class="d-flex gap-4 align-items-center">
            <p class="mb-0"><i class="fa-solid fa-paperclip me-1"></i> 0</p>
            <p class="mb-0"><i class="fa-regular fa-comment-dots me-1"></i> ${commentCount}</p>
            <i class="fa-solid fa-user-plus ms-auto"></i>
            <div class="d-flex flex-column gap-1">
                <i class="fa-solid fa-arrow-up move-up" onclick="moveTaskUp(this)"></i>
                <i class="fa-solid fa-arrow-down move-down" onclick="moveTaskDown(this)"></i>
            </div>
            <i class="fa-solid fa-trash delete-task" onclick="deleteTask('${newTask.id}', event)"></i>
        </div>
    `;

    // Stocker les informations de date limite dans les attributs data
    if (deadlineDate) {
        newTask.dataset.deadlineDate = deadlineDate;
        newTask.dataset.deadlineTime = deadlineTime || '23:59';
    }

    // Ajouter la nouvelle tâche au conteneur cible
    currentTaskColumn.appendChild(newTask);

    // Ajouter les commentaires temporaires à la tâche sans incrémenter le compteur
    temporaryComments.forEach(comment => {
        addCommentToTask(newTask, comment, false);
    });

    // Ajouter le commentaire passé directement lors de la création
    if (commentText && commentText.trim() !== '') {
        addCommentToTask(newTask, commentText, true);
    }

    // Réinitialiser les commentaires temporaires
    temporaryComments = [];
}

function addCommentToTask(taskElement, commentText, shouldIncrementCount = true) {
    // Stocker les commentaires dans les données de la tâche
    const comments = JSON.parse(taskElement.dataset.comments || '[]');
    comments.push(commentText);
    taskElement.dataset.comments = JSON.stringify(comments);

    // Mettre à jour le nombre de commentaires
    if (shouldIncrementCount) {
        const commentCountElement = taskElement.querySelector('.fa-comment-dots').nextSibling;
        const currentCommentCount = parseInt(commentCountElement.textContent.trim()) || 0;
        commentCountElement.textContent = ` ${currentCommentCount + 1}`;
    }
}

function moveTaskUp(arrow) {
    const task = arrow.closest('.task');
    const previousTask = task.previousElementSibling;

    if (previousTask && !previousTask.classList.contains('add-task-btn')) {
        task.parentElement.insertBefore(task, previousTask);
    }
}

function moveTaskDown(arrow) {
    const task = arrow.closest('.task');
    const nextTask = task.nextElementSibling;

    if (nextTask) {
        task.parentElement.insertBefore(nextTask, task);
    }
}

function deleteTask(taskId, event) {
    if (event) {
        event.stopPropagation();
    }

    const taskToDelete = document.getElementById(taskId);

    if (taskToDelete) {
        const confirmDelete = confirm("Êtes-vous sûr de vouloir supprimer cette tâche ?");
        if (confirmDelete) {
            taskToDelete.remove();
        }
    }
}

// FONCTIONS DE GESTION DU TEMPS
function calculateTimeLeft(deadlineDate, deadlineTime) {
    if (!deadlineDate) {
        return "0 Minutes";
    }

    const deadline = new Date(`${deadlineDate}T${deadlineTime || '23:59'}`);
    const now = new Date();
    const diff = deadline - now;

    if (diff < 0) {
        return "En retard";
    }

    // Convertir la différence en jours, heures et minutes
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    // Formater la durée restante
    if (days > 0) {
        return `${days}j ${hours}h`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes} Minutes`;
    }
}

function updateAllTaskTimers() {
    const tasks = document.querySelectorAll('.task[data-deadline-date]');

    tasks.forEach(task => {
        const deadlineDate = task.dataset.deadlineDate;
        const deadlineTime = task.dataset.deadlineTime;

        if (deadlineDate) {
            const timeLeftText = calculateTimeLeft(deadlineDate, deadlineTime);
            const timerElement = task.querySelector('.TaskHead p');

            if (timerElement) {
                timerElement.innerHTML = `<i class="fa-regular fa-clock me-1"></i>${timeLeftText}`;
            }
        }
    });
}

// FONCTIONS DE GESTION DES POPUPS
function ensurePopupOverlayExists() {
    let popupOverlay = document.getElementById('popupOverlay');
    
    if (!popupOverlay) {
        popupOverlay = document.createElement('div');
        popupOverlay.id = 'popupOverlay';
        popupOverlay.className = 'popup-overlay';
        document.body.appendChild(popupOverlay);
    }
    
    return popupOverlay;
}

function showTaskPopup(title, taskElement = null) {
    const popupOverlay = document.getElementById('popupOverlay');
    
    if (!popupOverlay) {
        console.error("L'élément popupOverlay n'existe pas dans le DOM");
        return;
    }
    
    const popupContent = createPopupHTML(title, taskElement);
    
    if (!popupContent) {
        console.error("Erreur lors de la génération du contenu du popup");
        return;
    }
    
    popupOverlay.innerHTML = popupContent;
    popupOverlay.classList.add('active');
    document.body.classList.add('popup-open');
    
    setTimeout(() => {
        const firstInput = popupOverlay.querySelector('input');
        if (firstInput) firstInput.focus();
    }, 100);
    
    window.taskBeingEdited = taskElement;
    setupPopupEventListeners(taskElement ? 'edit' : 'add');
}

function createPopupHTML(title, taskElement = null) {
    const taskData = taskElement ? {
        title: taskElement.querySelector('.task-header h5')?.textContent || '',
        description: taskElement.querySelector('.task-description p')?.textContent || '',
        deadlineDate: taskElement.dataset.deadlineDate === '0000-00-00' ? '' : taskElement.dataset.deadlineDate || '',
        deadlineTime: taskElement.dataset.deadlineTime || '23:59',
        status: taskElement.querySelector('.task-status')?.textContent || '',
        comments: JSON.parse(taskElement.dataset.comments || '[]')
    } : {
        title: '',
        description: '',
        deadlineDate: '',
        deadlineTime: '23:59',
        status: 'Backlog',
        comments: []
    };

    const formattedDeadline = taskData.deadlineDate 
        ? new Date(`${taskData.deadlineDate}T${taskData.deadlineTime}`).toLocaleString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
        : 'Non définie';

    return `
        <div class="task-form-container">
            <div class="form-header">
                <div class="project-info">Projet: AProjectO</div>
                <div class="close-button">&times;</div>
            </div>
            
            <div class="scrollable-content">
                <div class="task-header">
                    <input type="text" placeholder="Titre de la tâche" 
                           value="${escapeHtml(taskData.title)}" class="task-title-input">
                </div>
                
                <div class="task-meta">
                    <div class="status-display">
                        <span class="meta-label">Statut:</span>
                        <span class="status-value">${taskData.status}</span>
                    </div>
                    <div class="deadline-display">
                        <span class="meta-label">Date limite actuelle:</span>
                        <span class="deadline-value">${formattedDeadline}</span>
                    </div>
                </div>
                
                <div class="deadline-container">
                    <span class="deadline-label">Nouvelle date limite:</span>
                    <input type="date" id="task-deadline" class="deadline-date" 
                           value="${taskData.deadlineDate}">
                    <input type="time" id="task-deadline-time" class="deadline-time" 
                           value="${taskData.deadlineTime}">
                </div>
                
                <div class="form-fields">
                    <div class="form-field">
                        <div class="description-header">
                            <span class="field-icon">📝</span>
                            <span class="field-label">Description:</span>
                        </div>
                        <textarea id="description" class="task-description-input">${escapeHtml(taskData.description)}</textarea>
                    </div>
                </div>
                
                <div class="comment-section">
                    <div class="section-title">Commentaires (${taskData.comments.length})</div>
                    <div id="commentDisplay" class="comments-list">
                        ${taskData.comments.map(comment => `
                            <div class="comment-item">
                                <div class="comment-content">${escapeHtml(comment)}</div>
                                <div class="comment-date">${new Date().toLocaleString()}</div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="comment-box">
                        <div class="comment-input-container">
                            <div class="comment-toolbar">
                                <button type="button" class="toolbar-button" title="Gras"><strong>B</strong></button>
                                <button type="button" class="toolbar-button" title="Italique"><em>I</em></button>
                                <button type="button" class="toolbar-button" title="Liste">📋</button>
                                <button type="button" class="toolbar-button" title="Hashtag">#</button>
                            </div>
                            <div id="comment" class="comment-input" contenteditable="true" 
                                 placeholder="Ajouter un commentaire..."></div>
                            <button type="button" class="btn btn-send-comment">Envoyer</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="action-buttons">
                <button type="button" class="btn btn-primary btn-save">Enregistrer</button>
                <button type="button" class="btn btn-secondary btn-cancel">Annuler</button>
            </div>
        </div>
    `;
}

function setupPopupEventListeners(mode) {
    const popupOverlay = document.getElementById('popupOverlay');
    if (!popupOverlay) return;

    // Bouton de fermeture
    const closeButton = popupOverlay.querySelector('.close-button');
    if (closeButton) {
        closeButton.addEventListener('click', closePopup);
    }

    // Bouton Annuler
    const cancelButton = popupOverlay.querySelector('.btn-cancel');
    if (cancelButton) {
        cancelButton.addEventListener('click', closePopup);
    }

    // Bouton Enregistrer
    const saveButton = popupOverlay.querySelector('.btn-save');
    if (saveButton) {
        saveButton.addEventListener('click', () => {
            if (mode === 'add') {
                saveTask();
            } else {
                updateTask();
            }
        });
    }

    // Bouton Envoyer commentaire
    const sendCommentBtn = popupOverlay.querySelector('.btn-send-comment');
    if (sendCommentBtn) {
        sendCommentBtn.addEventListener('click', sendComment);
    }

    // Fermeture en cliquant à l'extérieur
    popupOverlay.addEventListener('click', (e) => {
        if (e.target === popupOverlay) {
            closePopup();
        }
    });
}

function loadPopup(url, title, initialData, setupFunction) {
    fetch(url)
        .then(response => response.text())
        .then(html => {
            const popupOverlay = document.getElementById('popupOverlay');
            popupOverlay.innerHTML = html;

            if (initialData) {
                popupOverlay.querySelector('.task-header input').value = initialData.title;
                popupOverlay.querySelector('#description').value = initialData.description;
                popupOverlay.querySelector('#task-deadline').value = initialData.deadlineDate;
                popupOverlay.querySelector('#task-deadline-time').value = initialData.deadlineTime;

                const commentDisplay = popupOverlay.querySelector('#commentDisplay');
                if (commentDisplay) {
                    commentDisplay.innerHTML = '';
                    initialData.comments.forEach(comment => {
                        const commentItem = document.createElement('div');
                        commentItem.className = 'comment-item mb-2 p-3 bg-light rounded';
                        commentItem.textContent = comment;
                        commentDisplay.appendChild(commentItem);
                    });
                }
            }

            popupOverlay.classList.add('active');

            if (setupFunction) setupFunction();
        })
        .catch(error => console.error('Erreur lors du chargement du popup :', error));
}

function closePopup() {
    const popupOverlay = document.getElementById('popupOverlay');
    if (popupOverlay) {
        popupOverlay.classList.remove('active');
        document.body.classList.remove('popup-open');
    }
    
    currentTaskColumn = null;
    window.taskBeingEdited = null;
    temporaryComments = [];
}

// FONCTIONS DE SAUVEGARDE/MISE À JOUR
function saveTask() {
    const popupOverlay = document.getElementById('popupOverlay');
    if (!popupOverlay) return;

    const title = popupOverlay.querySelector('.task-title-input')?.value;
    const description = popupOverlay.querySelector('.task-description-input')?.value;
    
    if (!title) {
        alert('Veuillez entrer un titre pour la tâche.');
        return;
    }

    console.log('Tâche sauvegardée:', { title, description });
    closePopup();
}

function updateTask() {
    const taskElement = window.taskBeingEdited;
    if (!taskElement) return;

    const popupOverlay = document.getElementById('popupOverlay');
    if (!popupOverlay) return;

    const title = popupOverlay.querySelector('.task-title-input')?.value;
    const description = popupOverlay.querySelector('.task-description-input')?.value;
    
    if (!title) {
        alert('Veuillez entrer un titre pour la tâche.');
        return;
    }

    if (taskElement.querySelector('.task-title')) {
        taskElement.querySelector('.task-title').textContent = title;
    }
    if (taskElement.querySelector('.task-description')) {
        taskElement.querySelector('.task-description').textContent = description;
    }

    closePopup();
}

function getTaskFormData() {
    const popupOverlay = document.getElementById('popupOverlay');
    
    return {
        title: popupOverlay.querySelector('.task-header input')?.value || '',
        description: popupOverlay.querySelector('#description')?.value || '',
        comment: popupOverlay.querySelector('#comment')?.value || '',
        deadlineDate: popupOverlay.querySelector('#task-deadline')?.value || '',
        deadlineTime: popupOverlay.querySelector('#task-deadline-time')?.value || ''
    };
}

// FONCTIONS DE GESTION DES COMMENTAIRES
function setupCommentToolbar() {
    const boldButton = document.querySelector(".Bold-button");
    const italicButton = document.querySelector(".Italic-button");
    const underlineButton = document.querySelector(".Underline-button");
    const listButton = document.querySelector(".toolbar-button:first-child");
    const hashtagButton = document.querySelector(".toolbar-button:nth-child(2)");
    const comment = document.getElementById('comment');

    if (!comment) return;

    function formatSelectedText(tag) {
        if (comment && (comment.tagName === 'TEXTAREA' || comment.tagName === 'INPUT')) {
            const start = comment.selectionStart;
            const end = comment.selectionEnd;
            const text = comment.value;
            const selectedText = text.substring(start, end);
            const isWrapped = selectedText.startsWith(`<${tag}>`) && selectedText.endsWith(`</${tag}>`);

            let newText;
            if (isWrapped) {
                newText = text.substring(0, start) + selectedText.slice(tag.length + 2, -(tag.length + 3)) + text.substring(end);
            } else {
                newText = text.substring(0, start) + `<${tag}>` + selectedText + `</${tag}>` + text.substring(end);
            }

            comment.value = newText;
            
            const newStart = isWrapped ? start : start + tag.length + 2;
            const newEnd = isWrapped ? end - (tag.length + 3) : end + tag.length + 2;
            comment.setSelectionRange(newStart, newEnd);
        }
    }

    if (boldButton) boldButton.addEventListener('click', e => { e.preventDefault(); formatSelectedText('strong'); });
    if (italicButton) italicButton.addEventListener('click', e => { e.preventDefault(); formatSelectedText('em'); });
    if (underlineButton) underlineButton.addEventListener('click', e => { e.preventDefault(); formatSelectedText('u'); });
    
    if (listButton) {
        listButton.addEventListener('click', e => {
            e.preventDefault();
            formatSelectedText('li');
        });
    }
    
    if (hashtagButton) {
        hashtagButton.addEventListener('click', e => {
            e.preventDefault();
            const start = comment.selectionStart;
            const end = comment.selectionEnd;
            const text = comment.value;
            const selectedText = text.substring(start, end);
            
            const newText = text.substring(0, start) + '#' + selectedText + text.substring(end);
            comment.value = newText;
            comment.setSelectionRange(start + 1, end + 1);
        });
    }
}

function sendComment() {
    const popupOverlay = document.getElementById('popupOverlay');
    if (!popupOverlay) return;

    const commentInput = popupOverlay.querySelector('#comment');
    if (!commentInput) return;

    const commentText = commentInput.innerText.trim();
    if (!commentText) return;

    const commentDisplay = popupOverlay.querySelector('#commentDisplay');
    if (commentDisplay) {
        const commentItem = document.createElement('div');
        commentItem.className = 'comment-item';
        commentItem.innerHTML = `<div class="comment-content">${commentText}</div>`;
        commentDisplay.appendChild(commentItem);
    }

    commentInput.innerText = '';
}

// FONCTIONS DE GLISSER-DÉPOSER
function allowDrop(event) {
    event.preventDefault();
}

function drag(event) {
    draggedTask = event.target;
    event.target.classList.add("dragging");
}

function drop(event) {
    event.preventDefault();
    const dropTarget = event.target.closest(".task-container");

    if (dropTarget && draggedTask) {
        dropTarget.appendChild(draggedTask);
        draggedTask.classList.remove("dragging");
        draggedTask = null;
    }
}

// FONCTIONS UTILITAIRES
function escapeHtml(unsafe) {
    return unsafe
        ? unsafe.toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
        : '';
}