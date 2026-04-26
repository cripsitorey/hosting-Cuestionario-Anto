let QUESTIONS = [];
let failedQuestions = []; 
let answered = 0;
let correct = 0;
let currentFilter = 'all';
let visibleQs = [];
let isReviewMode = false;

// ESTADO DE HERRAMIENTAS
let isExamMode = false;
let isTimerMode = false;
let timerValue = 45;
let globalTimerInterval = null;
let categoryStats = {}; 

async function inicializarCuestionario() {
    // Para agregar nuevos JSON, simplemente añade la ruta del archivo a este array.
    const archivos = [
        'data/cardiaco.json',
        'data/respiratorio.json',
        'data/calculos.json',
        'data/radiologia.json',
        'data/ekg.json',
        'data/fisiologia.json'
    ];
    try {
        const promesas = archivos.map(url => fetch(url).then(async res => res.ok ? await res.json() : null).catch(() => null));
        const resultados = await Promise.all(promesas);
        QUESTIONS = resultados.filter(res => res !== null && res.preguntas).flatMap(res => res.preguntas);
        
        // Inicializar categorías para analítica
        const categorias = [...new Set(QUESTIONS.map(q => q.cat))];
        categorias.forEach(c => categoryStats[c] = { correct: 0, total: 0 });
        
        updateMasteryUI();
        prepareVisibleQuestions();
        renderAll();
    } catch (error) { console.error("Error crítico:", error); }
}

function updateMasteryUI() {
    const container = document.getElementById('masteryIndex');
    if (!container) return;
    container.innerHTML = '';
    
    const catLabels = {
        cardiaco: 'Cardíaco', 
        respiratorio: 'Respiratorio', 
        calculo: 'Cálculos', 
        radiologia: 'Radiología', 
        ekg: 'EKG',
        fisiologia: 'Fisiología'
    };
    const colors = {
        cardiaco: 'var(--accent)', 
        respiratorio: 'var(--accent2)', 
        calculo: 'var(--warn)', 
        radiologia: '#b48cff', 
        ekg: '#ffc107',
        fisiologia: '#4ade80' // Color verde designado para fisiología
    };

    Object.keys(categoryStats).forEach(cat => {
        const stats = categoryStats[cat];
        const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
        
        container.innerHTML += `
            <div class="mastery-item">
                <div class="mastery-info"><span>${catLabels[cat] || cat}</span><span>${pct}%</span></div>
                <div class="mastery-bar"><div class="mastery-fill" style="width: ${pct}%; background: ${colors[cat] || 'var(--accent)'}"></div></div>
            </div>`;
    });
}

function toggleExamMode() { 
    isExamMode = document.getElementById('examModeToggle').checked; 
    restart(); 
}

function updateTimerValue() {
    const inputVal = parseInt(document.getElementById('customTimeInput').value);
    if (!isNaN(inputVal) && inputVal > 0) {
        timerValue = inputVal;
    }
}

function toggleTimerMode() { 
    isTimerMode = document.getElementById('timerToggle').checked; 
    document.getElementById('timerDisplay').style.display = isTimerMode ? 'block' : 'none';
    document.getElementById('timerConfig').style.display = isTimerMode ? 'block' : 'none';
    updateTimerValue();
    restart(); 
}

function startGlobalTimer() {
    clearInterval(globalTimerInterval);
    if (!isTimerMode || visibleQs.length === 0) return;
    
    let timeLeft = visibleQs.length * timerValue; 
    const display = document.getElementById('timerDisplay');
    display.style.display = 'block';
    
    const updateDisplay = () => {
        const mins = Math.floor(timeLeft / 60);
        const secs = timeLeft % 60;
        display.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    updateDisplay();
    
    globalTimerInterval = setInterval(() => {
        timeLeft--;
        updateDisplay();
        if (timeLeft <= 0) {
            clearInterval(globalTimerInterval);
            showSummary(); 
        }
    }, 1000);
}

function toggleFocusMode() { document.body.classList.toggle('focus-mode'); }

function renderAll() {
    const container = document.getElementById('questionsContainer');
    if (!container) return;
    container.innerHTML = '';
    document.getElementById('totalNum').textContent = visibleQs.length;
    
    if (visibleQs.length > 0) {
        visibleQs.forEach((q, idx) => {
            container.appendChild(buildCard(q, idx));
        });
        startGlobalTimer();
        document.getElementById('finishBtn').style.display = 'block';
    } else {
        document.getElementById('finishBtn').style.display = 'none';
        showSummary();
    }
    updateProgress();
}

function buildCard(q, idx) {
    const card = document.createElement('div');
    card.className = 'q-card';
    card.id = `card-${idx}`;
    const optsHTML = q.currentOpts.map((o, i) => `
        <button class="option-btn" onclick="answer(${idx}, ${i})" id="opt-${idx}-${i}">
            <span class="option-key">${['A','B','C','D','E'][i]}</span><span>${o}</span>
        </button>`).join('');

    card.innerHTML = `
        <div class="q-header"><span class="q-num">CASO · ${q.cat.toUpperCase()}</span><span class="q-text">${q.q}</span></div>
        <div class="options">${optsHTML}</div>
        <div class="hint-wrapper" style="${isExamMode ? 'display:none' : ''}">
            <button class="hint-btn" onclick="toggleHint(${idx})"><span>💡</span> Pista Diagnóstica</button>
            <div class="hint-box" id="hint-${idx}" style="display: none;">${q.hint || ''}</div>
        </div>
        <div class="feedback" id="fb-${idx}"></div>`;
    return card;
}

function answer(idx, chosen) {
    const q = visibleQs[idx];
    const card = document.getElementById(`card-${idx}`);
    if (!card || card.dataset.done) return;
    card.dataset.done = '1';

    const isCorrect = chosen === q.currentAns;
    
    categoryStats[q.cat].total++;
    if (isCorrect) categoryStats[q.cat].correct++;
    updateMasteryUI();

    if (!isExamMode) {
        const fb = document.getElementById(`fb-${idx}`);
        if (isCorrect) {
            correct++;
            fb.className = 'feedback correct';
            fb.innerHTML = `<strong>✓ VALIDACIÓN CORRECTA</strong><br>${q.just || ''}`;
            card.classList.add('answered-correct');
        } else {
            fb.className = 'feedback wrong';
            fb.innerHTML = `<strong>✗ ERROR: RESPUESTA ${['A','B','C','D','E'][q.currentAns]}</strong><br>${q.just || ''}`;
            card.classList.add('answered-wrong');
            if (!failedQuestions.some(fq => fq.q === q.q)) failedQuestions.push(q);
        }
        fb.style.display = 'block';
    } else {
        if (isCorrect) correct++;
        else if (!failedQuestions.some(fq => fq.q === q.q)) failedQuestions.push(q);
        card.classList.add('answered-exam');
        const selectedBtn = document.getElementById(`opt-${idx}-${chosen}`);
        if(selectedBtn) selectedBtn.style.borderColor = 'var(--accent)';
    }

    answered++;
    setTimeout(() => {
        const nextCard = document.querySelector('.q-card:not([data-done="1"])');
        if (nextCard) {
            const offset = 120; // Espacio para el navbar fijo
            const top = nextCard.getBoundingClientRect().top + window.scrollY - offset;
            window.scrollTo({ top: top, behavior: 'smooth' });
        }
    }, 4000);
    document.getElementById('scoreDisplay').textContent = correct;
    actualizarBotonRepaso();
    updateProgress();

    if (isCorrect) {
        setTimeout(() => {
            card.classList.add('hide-card');
            setTimeout(() => {
                card.style.display = 'none';
            }, 600);
        }, 5000);
    }

    if (answered === visibleQs.length) {
        setTimeout(showSummary, 1000);
    }
}

function showSummary() {
    clearInterval(globalTimerInterval);
    const summary = document.getElementById('summary');
    const report = document.getElementById('diagnosticReport');
    const finishBtn = document.getElementById('finishBtn');
    
    if (!summary) return;
    
    if (finishBtn) finishBtn.style.display = 'none';
    summary.style.display = 'block';
    report.innerHTML = '';

    const catLabels = {
        cardiaco: 'Cardíaco', 
        respiratorio: 'Respiratorio', 
        calculo: 'Cálculos', 
        radiologia: 'Radiología', 
        ekg: 'EKG',
        fisiologia: 'Fisiología'
    };

    Object.keys(categoryStats).forEach(cat => {
        const s = categoryStats[cat];
        if (s.total === 0) return;
        const pct = (s.correct / s.total) * 100;
        let advice = pct >= 90 ? "Dominio experto. Mantén el repaso." : pct >= 70 ? "Buen nivel. Revisa fallas específicas." : "Nivel crítico. Refuerza bibliografía base.";
        const catName = catLabels[cat] || cat; // Para usar el nombre formateado

        report.innerHTML += `
            <div class="diag-item">
                <span class="diag-category">${catName} (${Math.round(pct)}%)</span>
                <p>${advice}</p>
            </div>`;
    });

    document.getElementById('statCorrect').textContent = correct;
    document.getElementById('statWrong').textContent = answered - correct;
    document.getElementById('statPct').textContent = Math.round((correct / Math.max(1, answered)) * 100) + '%';
    summary.scrollIntoView({ behavior: 'smooth' });
}

function exportSession() {
    const data = { fecha: new Date().toISOString(), puntaje: correct, total: answered, analitica: categoryStats };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Sesion_MedQuest_${Date.now()}.json`;
    a.click();
}

function shuffle(array) { 
    for (let i = array.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [array[i], array[j]] = [array[j], array[i]]; 
    } 
    return array; 
}

function manualShuffle() { 
    shuffle(QUESTIONS); 
    restart(); 
}

function prepareVisibleQuestions() { 
    let pool = isReviewMode ? [...failedQuestions] : [...QUESTIONS];
    let filtered = pool.filter(q => currentFilter === 'all' || q.cat === currentFilter);
    visibleQs = filtered.map(q => {
        let opts = q.opts.map((text, i) => ({ text, isCorrect: i === q.ans }));
        shuffle(opts);
        return { ...q, currentOpts: opts.map(o => o.text), currentAns: opts.findIndex(o => o.isCorrect) };
    });
}

function filterCat(cat, btn) { 
    currentFilter = cat; 
    isReviewMode = false; 
    restart(); 
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active')); 
    if(btn) btn.classList.add('active'); 
}

function restart() { 
    answered = 0; 
    correct = 0; 
    clearInterval(globalTimerInterval);
    document.getElementById('summary').style.display = 'none';
    Object.keys(categoryStats).forEach(c => categoryStats[c] = {correct:0, total:0}); 
    updateMasteryUI();
    prepareVisibleQuestions(); 
    renderAll(); 
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateProgress() { 
    const total = visibleQs.length;
    const pct = total > 0 ? (answered / total) * 100 : 0;
    document.getElementById('progressBar').style.width = `${pct}%`;
    document.getElementById('progressNum').textContent = answered;
}

function actualizarBotonRepaso() { 
    const btn = document.getElementById('reviewBtn'); 
    btn.style.display = failedQuestions.length > 0 ? 'block' : 'none'; 
    document.getElementById('errorCount').textContent = failedQuestions.length; 
}

function toggleHint(idx) { 
    const h = document.getElementById(`hint-${idx}`); 
    h.style.display = h.style.display === 'none' ? 'block' : 'none'; 
}

function reviewErrors(btn) { 
    isReviewMode = true; 
    restart(); 
}

window.addEventListener('beforeunload', () => clearInterval(globalTimerInterval));
inicializarCuestionario();