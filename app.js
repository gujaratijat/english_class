const SUPABASE_URL = 'https://fixnefvoznegothpmehu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpeG5lZnZvem5lZ290aHBtZWh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwOTU0MzQsImV4cCI6MjEwNzY3MTQzNH0.zjydOx0wP9KFY1KiP2iaNiis_rGQ-bLPGKleUsXIiFI';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let testsDB = [], resultsDB = [], masterStudentsDB = [], draftQuestions = [], selectedTestIdx = null, activeStudentName = "", runningQuizData = [], studentAnswers = {};

// Alert Helper
function showAlert(msg, isErr = false) {
    document.getElementById('custom-alert-text').innerText = msg;
    document.getElementById('custom-alert-modal').classList.remove('hidden');
}
function closeCustomAlert() { document.getElementById('custom-alert-modal').classList.add('hidden'); }

// SPA Routing & Navigation with URL Hash
window.addEventListener('DOMContentLoaded', () => {
    checkStudentIdentityDisplay();
    loadMasterStudents();
    loadTestsFromSupabase();
    loadResultsFromSupabase();

    window.addEventListener('hashchange', handleUrlRouting);
    handleUrlRouting();
});

function navigateTo(view, subTab = '') {
    if(view === 'teacher') {
        if(localStorage.getItem('BEC_Teacher_LoggedIn') !== 'true') {
            document.getElementById('teacher-login-modal').classList.remove('hidden');
            return;
        }
        window.location.hash = `#teacher/${subTab}`;
    } else {
        window.location.hash = `#student/${subTab}`;
    }
}

function handleUrlRouting() {
    const hash = window.location.hash || '#student';
    if(hash.startsWith('#teacher')) {
        if(localStorage.getItem('BEC_Teacher_LoggedIn') !== 'true') {
            document.getElementById('teacher-login-modal').classList.remove('hidden');
            return;
        }
        document.getElementById('view-student').classList.add('hidden');
        document.getElementById('view-teacher').classList.remove('hidden');
        const parts = hash.split('/');
        if(parts[1]) switchTeacherTab(parts[1], false);
    } else {
        document.getElementById('view-teacher').classList.add('hidden');
        document.getElementById('view-student').classList.remove('hidden');
        const parts = hash.split('/');
        if(parts[1]) switchStudentTab(parts[1], false);
    }
}

// Teacher PIN Check & Refresh Auto-Logout
function checkTeacherAccess() {
    if(localStorage.getItem('BEC_Teacher_LoggedIn') === 'true') {
        navigateTo('teacher', 'master');
    } else {
        document.getElementById('teacher-login-modal').classList.remove('hidden');
    }
}
function closeTeacherLoginModal() { document.getElementById('teacher-login-modal').classList.add('hidden'); }

function verifyTeacherPin() {
    const pin = document.getElementById('teacher-pin-input').value;
    if(pin === "98732") {
        localStorage.setItem('BEC_Teacher_LoggedIn', 'true');
        closeTeacherLoginModal();
        navigateTo('teacher', 'master');
        loadMasterStudents();
        loadResultsFromSupabase();
    } else {
        showAlert("Incorrect PIN!", true);
    }
}

function logoutTeacher() {
    localStorage.removeItem('BEC_Teacher_LoggedIn');
    navigateTo('student');
}

// Student Identity Management
function checkStudentIdentityDisplay() {
    activeStudentName = localStorage.getItem('BEC_Student_Name') || "";
    document.getElementById('current-logged-student').innerText = activeStudentName || "Not Set";
}

function promptStudentIdentity() {
    const name = prompt("Enter your exact registered full name:", activeStudentName);
    if(name) {
        verifyStudentInMasterAndSet(name.trim());
    }
}

async function verifyStudentInMasterAndSet(name) {
    const { data } = await supabaseClient.from('students_master').select('*').ilike('student_name', name);
    if(!data || data.length === 0) {
        showAlert(`Error: "${name}" is not registered in the Student Master list by your teacher!`, true);
        return;
    }
    activeStudentName = data[0].student_name;
    localStorage.setItem('BEC_Student_Name', activeStudentName);
    checkStudentIdentityDisplay();
    renderStudentPortalLists();
}

// ================= SUPABASE DATA LOADING =================
async function loadMasterStudents() {
    const { data } = await supabaseClient.from('students_master').select('*').order('student_name');
    if(data) { masterStudentsDB = data; renderMasterStudentsTable(); renderStudentPortalLists(); }
}

async function loadTestsFromSupabase() {
    const { data } = await supabaseClient.from('tests').select('*');
    if(data) {
        testsDB = data.map(t => ({ id: t.id, title: t.title, passMark: t.pass_mark, timeLimit: t.time_limit, isUnlocked: t.is_unlocked, questions: t.questions_json }));
        renderStudentPortalLists();
        renderAdminTestsManager();
        populateChapterFilter();
    }
}

async function loadResultsFromSupabase() {
    const { data } = await supabaseClient.from('results').select('*').order('created_at', { ascending: false });
    if(data) {
        resultsDB = data.map(r => ({ id: r.id, date: new Date(r.created_at).toLocaleString(), student: r.student_name, testName: r.test_name, score: r.score, pct: r.percentage, grade: r.grade, status: r.status, allowRetake: r.allow_retake, wrongAnswersJson: r.wrong_answers_json }));
        renderStudentPortalLists();
        renderAdminChapterResults();
        loadRetakeRequests();
    }
}

// ================= STUDENT PORTAL TABS & LISTS =================
function switchStudentTab(tab, updateHash = true) {
    if(updateHash) window.location.hash = `#student/${tab}`;
    document.getElementById('stu-tab-pending').className = tab === 'pending' ? "pb-2 text-xs font-bold border-b-2 border-blue-600 text-blue-600" : "pb-2 text-xs font-bold text-slate-500";
    document.getElementById('stu-tab-completed').className = tab === 'completed' ? "pb-2 text-xs font-bold border-b-2 border-blue-600 text-blue-600" : "pb-2 text-xs font-bold text-slate-500";
    
    document.getElementById('student-pending-container').classList.toggle('hidden', tab !== 'pending');
    document.getElementById('student-completed-container').classList.toggle('hidden', tab !== 'completed');
    renderStudentPortalLists();
}

function renderStudentPortalLists() {
    if(!activeStudentName) {
        document.getElementById('student-pending-container').innerHTML = `<div class="p-4 bg-amber-50 rounded-xl text-xs text-amber-800">Please click 'Change Name' above and set your registered student name first.</div>`;
        return;
    }

    const pendingContainer = document.getElementById('student-pending-container');
    const completedContainer = document.getElementById('student-completed-container');
    pendingContainer.innerHTML = '';
    completedContainer.innerHTML = '';

    testsDB.forEach((t, idx) => {
        const attempt = resultsDB.find(r => r.student === activeStudentName && r.testName === t.title);

        if(attempt) {
            // Completed Item
            const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm";
            div.innerHTML = `
                <div>
                    <h4 class="font-bold text-sm text-slate-900">${t.title}</h4>
                    <p class="text-xs text-emerald-600 font-semibold">Completed ✓ Score: ${attempt.score} (${attempt.pct}%) | Status: ${attempt.status}</p>
                </div>
                <div>
                    ${attempt.allowRetake ? `<button onclick="startTestRules(${idx})" class="px-3 py-1.5 bg-amber-600 text-white font-bold rounded-xl text-xs">Retry Test</button>` : `<span class="text-xs text-slate-400 italic">Submitted (Awaiting Retry Approval)</span>`}
                </div>
            `;
            completedContainer.appendChild(div);
        } else {
            // Pending Item
            const div = document.createElement('div');
            div.className = "bg-white p-4 rounded-2xl border flex justify-between items-center shadow-sm";
            div.innerHTML = `
                <div>
                    <h4 class="font-bold text-sm text-slate-900">${t.title}</h4>
                    <p class="text-xs text-slate-500">Questions: ${t.questions.length} | Passing: ${t.passMark}%</p>
                </div>
                <div>
                    ${t.isUnlocked ? `<button onclick="startTestRules(${idx})" class="px-4 py-2 bg-blue-600 text-white font-bold rounded-xl text-xs">Start Test</button>` : `<span class="text-xs text-slate-400">Locked</span>`}
                </div>
            `;
            pendingContainer.appendChild(div);
        }
    });
}

function startTestRules(idx) {
    selectedTestIdx = idx;
    const t = testsDB[idx];
    document.getElementById('rule-test-title').innerText = t.title;
    document.getElementById('rule-pass-pct').innerText = `${t.passMark}%`;
    document.getElementById('rule-time-limit').innerText = t.timeLimit ? `${t.timeLimit} Mins` : `Unlimited`;
    document.getElementById('test-rules-screen').classList.remove('hidden');
}

function startActiveTest() {
    document.getElementById('test-rules-screen').classList.add('hidden');
    const t = testsDB[selectedTestIdx];
    document.getElementById('running-test-title').innerText = t.title;
    document.getElementById('running-student-name').innerText = activeStudentName;

    runningQuizData = t.questions.map((q, qIdx) => {
        let opts = [{text: q.correct, isCorrect:true}, {text: q.wrong1, isCorrect:false}, {text: q.wrong2, isCorrect:false}].sort(() => Math.random() - 0.5);
        return {id: qIdx, question: q.q, options: opts, correctIdx: opts.findIndex(o => o.isCorrect)};
    });

    studentAnswers = {};
    const wrapper = document.getElementById('quiz-questions-wrapper');
    wrapper.innerHTML = '';
    runningQuizData.forEach((q, qIdx) => {
        wrapper.innerHTML += `
            <div class="bg-white p-4 rounded-2xl border space-y-2">
                <p class="font-bold text-xs">Q${qIdx+1}. ${q.question}</p>
                <div class="space-y-1">
                    ${q.options.map((opt, oIdx) => `<label class="block p-2 bg-slate-50 rounded-xl text-xs cursor-pointer"><input type="radio" name="q_${qIdx}" value="${oIdx}" onchange="studentAnswers[${qIdx}]=${oIdx}"> ${opt.text}</label>`).join('')}
                </div>
            </div>
        `;
    });
    document.getElementById('active-test-container').classList.remove('hidden');
}

async function submitStudentQuiz(e) {
    e.preventDefault();
    const t = testsDB[selectedTestIdx];
    let score = 0, wrongList = [];
    runningQuizData.forEach((q, idx) => {
        let ans = studentAnswers[idx];
        if(ans === q.correctIdx) score++;
        else wrongList.push({qNumber: idx+1, question: q.question, studentAnswer: ans !== undefined ? q.options[ans].text : 'Unanswered', correctAnswer: q.options[q.correctIdx].text});
    });

    const total = runningQuizData.length;
    const pct = Math.round((score/total)*100);
    const status = pct >= t.passMark ? "PASS" : "FAIL";
    const grade = pct >= 90 ? "A+" : pct >= 75 ? "A" : pct >= 50 ? "C" : "F";

    await supabaseClient.from('results').insert([{
        student_name: activeStudentName, test_name: t.title, score: `${score} / ${total}`, percentage: pct, grade, status, allow_retake: false, wrong_answers_json: wrongList
    }]);

    document.getElementById('active-test-container').classList.add('hidden');
    document.getElementById('student-result-card').classList.remove('hidden');
    document.getElementById('res-student-name').innerText = activeStudentName;
    document.getElementById('res-test-name').innerText = t.title;
    document.getElementById('res-timestamp').innerText = new Date().toLocaleString();
    document.getElementById('res-score').innerText = `${score} / ${total}`;
    document.getElementById('res-pct').innerText = `${pct}%`;
    document.getElementById('res-grade').innerText = grade;
    document.getElementById('res-status').innerText = status;
    document.getElementById('congrats-remarks-box').className = status === 'PASS' ? "p-3 rounded-xl text-center text-xs font-bold bg-emerald-50 text-emerald-800" : "p-3 rounded-xl text-center text-xs font-bold bg-amber-50 text-amber-800";
    document.getElementById('congrats-remarks-box').innerText = status === 'PASS' ? "🎉 Passed Successfully!" : "⚠️ Needs Improvement.";

    loadResultsFromSupabase();
}

function shareResultAsPNGWhatsApp() {
    html2canvas(document.getElementById('printable-congrats-card'), {scale: 2}).then(canvas => {
        canvas.toBlob(blob => {
            const file = new File([blob], 'Certificate.png', {type: 'image/png'});
            if(navigator.canShare && navigator.canShare({files: [file]})) {
                navigator.share({files: [file], title: 'Certificate'});
            } else {
                const link = document.createElement('a');
                link.download = 'Certificate.png';
                link.href = canvas.toDataURL();
                link.click();
            }
        });
    });
}

// ================= TEACHER DASHBOARD TABS & CRUD =================
function switchTeacherTab(tab, updateHash = true) {
    if(updateHash) window.location.hash = `#teacher/${tab}`;
    ['master','tests','results','retakes'].forEach(t => {
        document.getElementById(`t-content-${t}`).classList.toggle('hidden', t !== tab);
        document.getElementById(`t-tab-${t}`).className = t === tab ? "pb-2 text-xs font-bold border-b-2 border-blue-600 text-blue-600" : "pb-2 text-xs font-bold text-slate-500";
    });
}

// Student Master CRUD Operations
async function saveStudentMasterRecord() {
    const name = document.getElementById('master-student-name-input').value.trim();
    const editId = document.getElementById('edit-student-id').value;
    if(!name) { showAlert('Enter name!', true); return; }

    if(editId) {
        await supabaseClient.from('students_master').update({student_name: name}).eq('id', editId);
    } else {
        await supabaseClient.from('students_master').insert([{student_name: name}]);
    }
    resetStudentMasterForm();
    loadMasterStudents();
}

function editStudentMaster(id, name) {
    document.getElementById('edit-student-id').value = id;
    document.getElementById('master-student-name-input').value = name;
    document.getElementById('save-student-btn').innerText = "Update Student";
    document.getElementById('cancel-student-btn').classList.remove('hidden');
}

function resetStudentMasterForm() {
    document.getElementById('edit-student-id').value = '';
    document.getElementById('master-student-name-input').value = '';
    document.getElementById('save-student-btn').innerText = "Save Student";
    document.getElementById('cancel-student-btn').classList.add('hidden');
}

async function deleteStudentMaster(id) {
    if(confirm('Delete student from master list?')) {
        await supabaseClient.from('students_master').delete().eq('id', id);
        loadMasterStudents();
    }
}

function renderMasterStudentsTable() {
    const container = document.getElementById('master-students-table-list');
    document.getElementById('master-count').innerText = masterStudentsDB.length;
    container.innerHTML = masterStudentsDB.map(s => `
        <div class="p-3 bg-slate-50 border rounded-xl flex justify-between items-center">
            <b>${s.student_name}</b>
            <div class="flex gap-2">
                <button onclick="editStudentMaster(${s.id}, '${s.student_name}')" class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg">Edit</button>
                <button onclick="deleteStudentMaster(${s.id})" class="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg">Delete</button>
            </div>
        </div>
    `).join('');
}

// Chapter-wise Results & Pending Status Report for Teachers
function populateChapterFilter() {
    const sel = document.getElementById('admin-chapter-filter');
    sel.innerHTML = '<option value="">All Chapters</option>';
    testsDB.forEach(t => sel.innerHTML += `<option value="${t.title}">${t.title}</option>`);
}

function renderAdminChapterResults() {
    const filter = document.getElementById('admin-chapter-filter').value;
    const container = document.getElementById('chapter-wise-report-container');
    container.innerHTML = '';

    const testsToDisplay = filter ? testsDB.filter(t => t.title === filter) : testsDB;

    testsToDisplay.forEach(t => {
        let submittedStudents = resultsDB.filter(r => r.testName === t.title);
        let unattemptedStudents = masterStudentsDB.filter(m => !submittedStudents.some(s => s.student === m.student_name));

        let html = `
            <div class="p-4 bg-slate-50 border rounded-2xl space-y-2">
                <h4 class="font-bold text-blue-900">${t.title}</h4>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    <div class="bg-white p-3 rounded-xl border">
                        <span class="font-bold text-emerald-700 block mb-1">Submitted (${submittedStudents.length}):</span>
                        ${submittedStudents.length ? submittedStudents.map(s => `<div>• ${s.student} - <b>${s.score} (${s.pct}\%)</b> [${s.status}]</div>`).join('') : '<i class="text-slate-400">None</i>'}
                    </div>
                    <div class="bg-white p-3 rounded-xl border">
                        <span class="font-bold text-rose-700 block mb-1">Pending / Unattempted (${unattemptedStudents.length}):</span>
                        ${unattemptedStudents.length ? unattemptedStudents.map(u => `<div>• ${u.student_name}</div>`).join('') : '<i class="text-slate-400">All submitted!</i>'}
                    </div>
                </div>
            </div>
        `;
        container.innerHTML += html;
    });
}

// Test Builder Drafts & Manager
function addQuestionToBuilderDraft() {
    const q = document.getElementById('builder-q-text').value.trim();
    const correct = document.getElementById('builder-correct').value.trim();
    const w1 = document.getElementById('builder-w1').value.trim();
    const w2 = document.getElementById('builder-w2').value.trim();
    if(!q || !correct || !w1 || !w2) { showAlert('Fill question and options!', true); return; }
    draftQuestions.push({q, correct, wrong1: w1, wrong2: w2});
    document.getElementById('builder-q-text').value = '';
    document.getElementById('builder-correct').value = '';
    document.getElementById('builder-w1').value = '';
    document.getElementById('builder-w2').value = '';
    renderBuilderDraft();
}

function renderBuilderDraft() {
    document.getElementById('builder-draft-list').innerHTML = draftQuestions.map((d, i) => `<div>Q${i+1}. ${d.q}</div>`).join('');
}

async function publishTestToSupabase() {
    const title = document.getElementById('builder-title').value.trim();
    const pass = parseInt(document.getElementById('builder-pass').value) || 50;
    const time = parseInt(document.getElementById('builder-time').value) || null;
    if(!title || draftQuestions.length === 0) { showAlert('Add title and questions!', true); return; }

    await supabaseClient.from('tests').insert([{title, pass_mark: pass, time_limit: time, is_unlocked: false, questions_json: draftQuestions}]);
    showAlert('Test published successfully!');
    draftQuestions = [];
    renderBuilderDraft();
    loadTestsFromSupabase();
}

function renderAdminTestsManager() {
    const container = document.getElementById('admin-tests-list-manager');
    container.innerHTML = testsDB.map(t => `
        <div class="p-3 bg-slate-50 border rounded-xl flex justify-between items-center">
            <b>${t.title} (${t.questions.length} Qs)</b>
            <div class="flex gap-2">
                <button onclick="toggleTestLock(${t.id}, ${!t.isUnlocked})" class="px-3 py-1 ${t.isUnlocked ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'} rounded-lg">${t.isUnlocked ? 'Unlocked' : 'Locked'}</button>
                <button onclick="deleteTest(${t.id})" class="px-2 py-1 bg-rose-50 text-rose-700 rounded-lg">Delete</button>
            </div>
        </div>
    `).join('');
}

async function toggleTestLock(id, state) {
    await supabaseClient.from('tests').update({is_unlocked: state}).eq('id', id);
    loadTestsFromSupabase();
}

async function deleteTest(id) {
    if(confirm('Delete test?')) {
        await supabaseClient.from('tests').delete().eq('id', id);
        loadTestsFromSupabase();
    }
}

// Retake Approvals
async function loadRetakeRequests() {
    const { data } = await supabaseClient.from('retake_requests').select('*').eq('status', 'pending');
    const container = document.getElementById('admin-retake-requests-list');
    if(!data || data.length === 0) { container.innerHTML = `<i class="text-slate-400">No pending requests.</i>`; return; }
    container.innerHTML = data.map(r => `
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl flex justify-between items-center">
            <span>Student: <b>${r.student_name}</b> | Test: <b>${r.test_name}</b></span>
            <button onclick="approveRetake(${r.id}, '${r.student_name}', '${r.test_name}')" class="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold">Approve Retry</button>
        </div>
    `).join('');
}

async function approveRetake(reqId, student, test) {
    await supabaseClient.from('results').update({allow_retake: true}).eq('student_name', student).eq('test_name', test);
    await supabaseClient.from('retake_requests').delete().eq('id', reqId);
    showAlert('Retry approved for student!');
    loadRetakeRequests();
    loadResultsFromSupabase();
}
