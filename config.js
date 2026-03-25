// Cargar el sonido personalizado
const cashSound = new Audio('moneda.mp3');
cashSound.volume = 0.5; // Ajusta el volumen de 0 a 1

// 1. ESTADO CENTRAL DE LA APLICACIÓN
const appState = JSON.parse(localStorage.getItem('alcancia_pro_data')) || {
    goals: [],
    archivedGoals: [], // Nuevo array para el historial
    activeGoalId: null
};

// 2. OBJETO PRINCIPAL DE LA APP (Lógica y UI)
const app = {
    // Referencias al DOM
    dom: {
        goalsList: document.getElementById('goals-list'),
        historyList: document.getElementById('history-list'),      // ✅ NUEVO
        historyCount: document.getElementById('history-count'),    // ✅ NUEVO
        emptyState: document.getElementById('empty-state'),
        activeView: document.getElementById('active-goal-view'),
        grid: document.getElementById('grid-container'),
        piggy: document.getElementById('piggy-icon'),
        modal: document.getElementById('modal-transaction'),
        modalContent: document.getElementById('modal-content'),
        form: document.getElementById('form-goal'),
        toasts: document.getElementById('toast-container')
    },

    // Métodos de Interfaz (UI)
    ui: {
        openModal: (goalId = null) => {
            app.dom.form.reset();
            document.getElementById('goal-id').value = '';
            document.getElementById('modal-title').innerText = 'Registrar Meta';

            if (goalId) {
                const goal = appState.goals.find(g => g.id === goalId);
                if (goal) {
                    document.getElementById('modal-title').innerText = 'Editar Meta';
                    document.getElementById('goal-id').value = goal.id;
                    document.getElementById('goal-name').value = goal.name;
                    document.getElementById('goal-target').value = goal.target;
                    document.getElementById('goal-daily').value = goal.daily;
                }
            }

            app.dom.modal.classList.remove('hidden');
            // Pequeño delay para la animación de opacidad/escala
            setTimeout(() => {
                app.dom.modal.classList.remove('opacity-0');
                app.dom.modalContent.classList.remove('scale-95');
            }, 10);
        },

        closeModal: () => {
            app.dom.modal.classList.add('opacity-0');
            app.dom.modalContent.classList.add('scale-95');
            setTimeout(() => {
                app.dom.modal.classList.add('hidden');
            }, 300);
        },

        showToast: (msg, type = 'success') => {
            // 1. Control de máximo 2 notificaciones
            const currentToasts = app.dom.toasts.querySelectorAll('.toast-msg');
            if (currentToasts.length >= 2) currentToasts[0].remove();

            // 2. Reproducir tu sonido personalizado (solo si es éxito/ahorro)
            if (type === 'success') {
                cashSound.currentTime = 0; // Reinicia el audio por si se toca muy rápido
                cashSound.play().catch(error => console.log("El navegador bloqueó el audio inicial:", error));
            }

            // 3. Crear el elemento visual (El resto del código sigue igual)
            const toast = document.createElement('div');
            const color = type === 'success' ? 'bg-emerald-500' : 'bg-rose-500';

            toast.className = `toast-msg flex items-center gap-3 px-6 py-3 rounded-full text-white font-bold shadow-lg shadow-black/40 ${color} ring-2 ring-white/20`;
            toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-coins' : 'fa-exclamation'}"></i> <span>${msg}</span>`;

            app.dom.toasts.appendChild(toast);

            // Temporizador para desaparecer
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.animation = 'slideUp 0.4s reverse forwards';
                    setTimeout(() => toast.remove(), 400);
                }
            }, 3000);
        },

        animatePiggy: () => {
            app.dom.piggy.classList.remove('piggy-jump');
            void app.dom.piggy.offsetWidth; // Reflow
            app.dom.piggy.classList.add('piggy-jump');
        },

        renderGoalsList: () => {
            app.dom.goalsList.innerHTML = '';

            if (appState.goals.length === 0) {
                app.dom.goalsList.innerHTML = `<p class="text-sm text-slate-500 text-center py-4">No hay metas registradas.</p>`;
                return;
            }

            appState.goals.forEach(goal => {
                const totalDays = Math.ceil(goal.target / goal.daily);
                const savedAmount = goal.savedDays.length * goal.daily;
                const percent = Math.min((savedAmount / goal.target) * 100, 100).toFixed(0);
                const isActive = appState.activeGoalId === goal.id;

                const div = document.createElement('div');
                div.className = `p-4 rounded-2xl border cursor-pointer transition-all ${isActive ? 'bg-emerald-500/10 border-emerald-500/50' : 'bg-slate-800/50 border-white/5 hover:border-emerald-500/30'}`;
                div.onclick = (e) => {
                    if (!e.target.closest('button')) app.logic.setActiveGoal(goal.id);
                };

                div.innerHTML = `
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="font-bold text-slate-200">${goal.name}</h4>
                                    <p class="text-xs text-slate-400">S/ ${goal.target} (S/ ${goal.daily}/día)</p>
                                </div>
                                <div class="flex gap-2">
                                    <button onclick="app.ui.openModal('${goal.id}')" class="text-slate-400 hover:text-sky-400 transition"><i class="fas fa-edit"></i></button>
                                    <button onclick="app.logic.deleteGoal('${goal.id}')" class="text-slate-400 hover:text-rose-400 transition"><i class="fas fa-trash"></i></button>
                                </div>
                            </div>
                            <div class="h-1.5 bg-slate-900 rounded-full overflow-hidden mt-3">
                                <div class="h-full bg-emerald-500 rounded-full" style="width: ${percent}%"></div>
                            </div>
                        `;
                app.dom.goalsList.appendChild(div);
            });
        },

        renderActiveGoal: () => {
            const goal = appState.goals.find(g => g.id === appState.activeGoalId);

            if (!goal) {
                app.dom.activeView.classList.add('hidden');
                app.dom.emptyState.classList.remove('hidden');
                return;
            }

            if (!goal.savedDays) goal.savedDays = [];
            app.dom.emptyState.classList.add('hidden');
            app.dom.activeView.classList.remove('hidden');

            // Cálculos matemáticos de la meta
            const totalDays = Math.ceil(goal.target / goal.daily);
            let savedAmount = goal.savedDays.length * goal.daily;
            if (savedAmount > goal.target) savedAmount = goal.target;

            const remainingAmount = goal.target - savedAmount;
            const daysLeft = totalDays - goal.savedDays.length;
            const percent = (savedAmount / goal.target) * 100;

            // Fecha estimada
            const dateObj = new Date();
            dateObj.setDate(dateObj.getDate() + daysLeft);
            const estimatedDate = daysLeft === 0 ? '¡Completado!' : dateObj.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

            // Actualizar textos
            document.getElementById('view-title').innerText = goal.name;
            document.getElementById('view-saved').innerText = `S/ ${savedAmount.toLocaleString()}`;
            document.getElementById('view-remaining').innerText = `S/ ${remainingAmount.toLocaleString()}`;
            document.getElementById('view-days-left').innerText = daysLeft;
            document.getElementById('view-date').innerText = estimatedDate;
            document.getElementById('view-target').innerText = `Meta: S/ ${goal.target.toLocaleString()}`;
            document.getElementById('view-percent').innerText = `${percent.toFixed(1)}%`;
            document.getElementById('view-bar').style.width = `${percent}%`;
            document.getElementById('view-daily-amount').innerText = goal.daily;

            // Generar Tablero (Grilla) dinámicamente
            app.dom.grid.innerHTML = '';
            for (let i = 1; i <= totalDays; i++) {
                const btn = document.createElement('button');
                const isSaved = goal.savedDays.includes(i);

                btn.className = `day-btn ${isSaved ? 'saved' : ''}`;
                btn.innerHTML = isSaved ? '<i class="fas fa-check"></i>' : i;
                btn.onclick = () => app.logic.toggleDay(goal.id, i);

                app.dom.grid.appendChild(btn);
            }
        },

        renderHistory: () => {
            const container = app.dom.historyList;
            const countBadge = app.dom.historyCount;

            container.innerHTML = '';

            // Si no existe el array (por versiones viejas) o está vacío
            if (!appState.archivedGoals || appState.archivedGoals.length === 0) {
                countBadge.innerText = '0';
                container.innerHTML = '<p class="text-[11px] text-slate-600 italic text-center py-2">No tienes metas archivadas.</p>';
                return;
            }

            countBadge.innerText = appState.archivedGoals.length;

            // Ordenar para mostrar las recién archivadas arriba
            const sortedHistory = [...appState.archivedGoals].sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));

            sortedHistory.forEach(goal => {
                // Formateo de fecha localizado
                const dateStr = new Date(goal.archivedAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });

                const div = document.createElement('div');
                div.className = "flex justify-between items-center p-3 bg-slate-800/30 rounded-xl border border-white/5 hover:border-white/10 transition-colors";

                div.innerHTML = `
            <div>
                <p class="text-sm font-bold text-slate-400">${goal.name}</p>
                <p class="text-[10px] text-slate-500"><i class="far fa-calendar-alt mr-1"></i>Archivada: ${dateStr}</p>
            </div>
            <div class="flex gap-1">
                <button onclick="app.logic.restoreGoal('${goal.id}')" title="Restaurar Meta" 
                    class="text-emerald-500/70 hover:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 p-2 rounded-lg transition-all">
                    <i class="fas fa-undo-alt text-xs"></i>
                </button>
                <button onclick="app.logic.deletePermanent('${goal.id}')" title="Eliminar definitivamente" 
                    class="text-rose-500/70 hover:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 p-2 rounded-lg transition-all">
                    <i class="fas fa-trash-alt text-xs"></i>
                </button>
            </div>
        `;
                container.appendChild(div);
            });
        }
    },

    // Lógica de Negocio y Datos
    logic: {
        saveData: () => {
            localStorage.setItem('alcancia_pro_data', JSON.stringify(appState));
            app.ui.renderGoalsList();
            app.ui.renderActiveGoal();
            app.ui.renderHistory(); // Añadimos esto para refrescar el historial
        },

        // Archivar (En lugar de borrar directamente)
        archiveGoal: (id) => {
            const index = appState.goals.findIndex(g => g.id === id);
            if (index !== -1) {
                // Sacamos la meta de 'goals'
                const goalToArchive = appState.goals.splice(index, 1)[0];

                // Le añadimos la fecha exacta en la que se archivó
                goalToArchive.archivedAt = new Date().toISOString();

                // La metemos al historial
                if (!appState.archivedGoals) appState.archivedGoals = []; // Por si acaso
                appState.archivedGoals.push(goalToArchive);

                // Si la meta archivada era la activa, quitamos la selección
                if (appState.activeGoalId === id) {
                    appState.activeGoalId = appState.goals.length > 0 ? appState.goals[0].id : null;
                }

                app.logic.saveData();
                app.ui.showToast('Meta archivada al historial', 'success');
            }
        },

        // Restaurar desde el historial
        restoreGoal: (id) => {
            const index = appState.archivedGoals.findIndex(g => g.id === id);
            if (index !== -1) {
                // Sacamos del historial
                const goalToRestore = appState.archivedGoals.splice(index, 1)[0];

                // Le quitamos la propiedad de 'archivedAt' para dejarla limpia
                delete goalToRestore.archivedAt;

                // La devolvemos a las metas activas
                appState.goals.push(goalToRestore);

                app.logic.saveData();
                app.ui.showToast('Meta restaurada con éxito', 'success');
            }
        },

        // Eliminar para siempre
        deletePermanent: (id) => {
            if (!confirm('¿Seguro que quieres borrar esta meta para siempre? Se perderá todo el progreso registrado.')) return;

            appState.archivedGoals = appState.archivedGoals.filter(g => g.id !== id);
            app.logic.saveData();
            app.ui.showToast('Meta eliminada permanentemente', 'error');
        },

        saveGoal: (e) => {
            e.preventDefault();
            const id = document.getElementById('goal-id').value;
            const name = document.getElementById('goal-name').value;
            const target = parseFloat(document.getElementById('goal-target').value);
            const daily = parseFloat(document.getElementById('goal-daily').value);

            if (target <= 0 || daily <= 0 || target < daily) {
                app.ui.showToast('Verifica los montos ingresados.', 'error');
                return;
            }

            if (id) {
                // Editar existente
                const goal = appState.goals.find(g => g.id === id);
                if (goal) {
                    if (goal.target !== target || goal.daily !== daily) {
                        if (!confirm("Cambiar los montos reiniciará el progreso de los días. ¿Continuar?")) return;
                        goal.savedDays = []; // Reiniciar si cambian reglas matemáticas
                    }
                    goal.name = name;
                    goal.target = target;
                    goal.daily = daily;
                    app.ui.showToast('Meta actualizada');
                }
            } else {
                // Crear nueva
                const newGoal = {
                    id: 'goal_' + Date.now(),
                    name,
                    target,
                    daily,
                    savedDays: []
                };
                appState.goals.push(newGoal);
                appState.activeGoalId = newGoal.id;
                app.ui.showToast('Meta creada con éxito');
            }

            app.logic.saveData();
            app.ui.closeModal();
        },

        deleteGoal: (id) => {
            if (!confirm('¿Estás seguro de eliminar esta meta? Perderás todo el historial.')) return;

            appState.goals = appState.goals.filter(g => g.id !== id);
            if (appState.activeGoalId === id) {
                appState.activeGoalId = appState.goals.length > 0 ? appState.goals[0].id : null;
            }
            app.logic.saveData();
            app.ui.showToast('Meta eliminada');
        },

        setActiveGoal: (id) => {
            appState.activeGoalId = id;
            app.logic.saveData();
        },

        toggleDay: (goalId, dayIndex) => {
            const goal = appState.goals.find(g => g.id === goalId);
            if (!goal) return;

            const arrayIndex = goal.savedDays.indexOf(dayIndex);
            let isAdding = false;

            if (arrayIndex > -1) {
                goal.savedDays.splice(arrayIndex, 1); // Desmarcar
            } else {
                goal.savedDays.push(dayIndex); // Marcar
                isAdding = true;
            }

            app.logic.saveData();

            // Gamificación
            if (isAdding) {
                app.ui.animatePiggy();

                const totalDays = Math.ceil(goal.target / goal.daily);
                const progress = goal.savedDays.length;

                if (progress === totalDays) {
                    // ✅ CUANDO SE COMPLETA, AUTOMÁTICAMENTE ARCHIVA
                    app.ui.showToast(`🎉 ¡Meta completada: ${goal.name}! Archivando...`);
                    setTimeout(() => {
                        app.logic.archiveGoal(goal.id);
                    }, 1500); // Pequeño delay para que vea el mensaje primero
                } else if (progress === Math.floor(totalDays / 2)) {
                    app.ui.showToast('¡Mitad de camino alcanzado! 🚀');
                } else {
                    app.ui.showToast(`+ S/ ${goal.daily} guardados`);
                }
            }
        }
    },

    // Iniciar App
    init: () => {
        app.ui.renderGoalsList();
        app.ui.renderActiveGoal();
        app.ui.renderHistory();
    }
};

// Arrancar
document.addEventListener('DOMContentLoaded', app.init);