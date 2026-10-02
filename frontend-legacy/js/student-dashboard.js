(function () {
    const state = {
        stats: null,
        history: [],
    };

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    function currentMonthValue(date = new Date()) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    }

    function normalizeStatus(status) {
        return String(status || '').trim().toLowerCase();
    }

    function parseDateOnly(value) {
        if (!value) return null;
        const datePart = String(value).slice(0, 10);
        const [year, month, day] = datePart.split('-').map(Number);
        if (!year || !month || !day) return null;
        return new Date(year, month - 1, day);
    }

    function formatDateOnly(date) {
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function todayDateOnly() {
        const date = new Date();
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function compareDates(left, right) {
        return left.getTime() - right.getTime();
    }

    function maxDate(left, right) {
        return compareDates(left, right) >= 0 ? left : right;
    }

    function minDate(left, right) {
        return compareDates(left, right) <= 0 ? left : right;
    }

    function addDays(date, days) {
        const clone = new Date(date);
        clone.setDate(clone.getDate() + days);
        return clone;
    }

    function diffDaysInclusive(startDate, endDate) {
        if (compareDates(endDate, startDate) < 0) return 0;
        const milliseconds = endDate.getTime() - startDate.getTime();
        return Math.floor(milliseconds / 86400000) + 1;
    }

    function monthLabel(monthValue) {
        const [year, month] = monthValue.split('-').map(Number);
        if (!year || !month) return '--';
        return new Date(year, month - 1, 1).toLocaleString('en-US', {
            month: 'long',
            year: 'numeric',
        });
    }

    function yearFromMonth(monthValue) {
        const year = Number(String(monthValue || '').slice(0, 4));
        return Number.isFinite(year) && year > 0 ? year : new Date().getFullYear();
    }

    function daysInMonth(monthValue) {
        const [year, month] = monthValue.split('-').map(Number);
        if (!year || !month) return 0;
        return new Date(year, month, 0).getDate();
    }

    function isCurrentVisibleMonth(date, monthValue) {
        const [year, month] = monthValue.split('-').map(Number);
        return (
            year === date.getFullYear() &&
            month === date.getMonth() + 1
        );
    }

    function startOfMonth(monthValue) {
        const [year, month] = monthValue.split('-').map(Number);
        return new Date(year, month - 1, 1);
    }

    function endOfMonth(monthValue) {
        const [year, month] = monthValue.split('-').map(Number);
        return new Date(year, month, 0);
    }

    function startOfYear(yearValue) {
        return new Date(Number(yearValue), 0, 1);
    }

    function endOfYear(yearValue) {
        return new Date(Number(yearValue), 11, 31);
    }

    function getRecordMap(history) {
        const map = new Map();
        for (const record of history) {
            if (record && record.date) {
                map.set(String(record.date).slice(0, 10), record);
            }
        }
        return map;
    }

    function getBaselineDate(history = []) {
        const fromStats = parseDateOnly(state.stats?.calculation_start_date);
        if (fromStats) return fromStats;

        const fromUser = parseDateOnly(window.currentUser?.created_at);
        if (fromUser) return fromUser;

        const sorted = history
            .map((record) => parseDateOnly(record.date))
            .filter(Boolean)
            .sort((left, right) => compareDates(left, right));
        if (sorted.length) return sorted[0];

        return todayDateOnly();
    }

    function getFinalizedThroughDate(history = []) {
        const fromStats = parseDateOnly(state.stats?.calculation_through_date);
        if (fromStats) return fromStats;

        const today = todayDateOnly();
        const todayKey = formatDateOnly(today);
        const hasTodayRecord = history.some((record) => String(record?.date || '').slice(0, 10) === todayKey);
        if (hasTodayRecord) return today;
        return today;
    }

    function buildPeriodSummary(history, periodStart, periodEnd, baselineDate, finalizedThroughDate) {
        const start = maxDate(periodStart, baselineDate);
        const end = minDate(periodEnd, finalizedThroughDate);
        const recordMap = getRecordMap(history);

        let present = 0;
        let late = 0;
        let absent = 0;

        if (compareDates(end, start) >= 0) {
            for (let current = new Date(start); compareDates(current, end) <= 0; current = addDays(current, 1)) {
                const record = recordMap.get(formatDateOnly(current));
                const status = normalizeStatus(record?.status);

                if (status === 'present') {
                    present += 1;
                } else if (status === 'late') {
                    late += 1;
                } else {
                    absent += 1;
                }
            }
        }

        const attended = present + late;
        const marked = present + late + absent;
        const percentage = marked > 0 ? Math.round((attended / marked) * 1000) / 10 : 0;
        const pending = compareDates(periodEnd, finalizedThroughDate) > 0
            ? diffDaysInclusive(maxDate(maxDate(addDays(finalizedThroughDate, 1), periodStart), baselineDate), periodEnd)
            : 0;

        return {
            present,
            late,
            absent,
            attended,
            marked,
            pending,
            percentage,
            recordCount: marked,
        };
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function setHTML(id, value) {
        const el = document.getElementById(id);
        if (el) el.innerHTML = value;
    }

    function renderCalendar(monthValue, history, baselineDate, finalizedThroughDate) {
        const grid = document.getElementById('attendanceCalendarGrid');
        if (!grid) return;

        const [year, month] = monthValue.split('-').map(Number);
        if (!year || !month) {
            grid.innerHTML = '';
            return;
        }

        const firstDay = new Date(year, month - 1, 1);
        const totalDays = new Date(year, month, 0).getDate();
        const offset = firstDay.getDay();
        const today = todayDateOnly();
        const recordsByDate = getRecordMap(history);

        grid.innerHTML = '';

        for (let index = 0; index < offset; index += 1) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'calendar-day is-empty';
            grid.appendChild(emptyCell);
        }

        for (let day = 1; day <= totalDays; day += 1) {
            const date = new Date(year, month - 1, day);
            date.setHours(0, 0, 0, 0);
            const dateKey = `${monthValue}-${pad(day)}`;
            const record = recordsByDate.get(dateKey) || null;
            const normalized = normalizeStatus(record?.status);
            const isBeforeBaseline = compareDates(date, baselineDate) < 0;
            const isFuture = compareDates(date, today) > 0;
            const isPending = compareDates(date, finalizedThroughDate) > 0 && compareDates(date, today) <= 0;

            let cellStatus = 'unmarked';
            let statusLabel = 'Unmarked';
            let meta = 'No attendance recorded yet';

            if (isBeforeBaseline) {
                cellStatus = 'empty';
                statusLabel = 'Pre-Enrollment';
                meta = 'Before enrollment';
            } else if (isFuture) {
                cellStatus = 'future';
                statusLabel = 'Upcoming';
                meta = 'Awaiting class day';
            } else if (record) {
                if (normalized === 'present') {
                    cellStatus = 'present';
                    statusLabel = 'Present';
                    meta = `${String(record.check_in || '--:--').slice(0, 5)} • ${record.method === 'face' ? 'Biometric' : 'Manual'}`;
                } else if (normalized === 'late') {
                    cellStatus = 'late';
                    statusLabel = 'Late';
                    meta = `${String(record.check_in || '--:--').slice(0, 5)} • ${record.method === 'face' ? 'Biometric' : 'Manual'}`;
                } else if (normalized === 'absent') {
                    cellStatus = 'absent';
                    statusLabel = 'Absent';
                    meta = 'Marked absent';
                }
            } else if (isPending) {
                cellStatus = 'pending';
                statusLabel = 'Pending';
                meta = 'Not finalized';
            } else {
                cellStatus = 'absent';
                statusLabel = 'Absent';
                meta = 'No record, counted absent';
            }

            const cell = document.createElement('div');
            cell.className = `calendar-day is-${cellStatus}`;
            cell.title = `${date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })} • ${statusLabel}`;
            cell.innerHTML = `
                <div class="calendar-day-number">${day}</div>
                <div class="calendar-day-status">${statusLabel}</div>
                <div class="calendar-day-meta">${meta}</div>
            `;
            grid.appendChild(cell);
        }
    }

    function renderSummaryCard(prefix, summary, labelPrefix, label) {
        setText(`${labelPrefix}AttendancePercent`, `${summary.percentage.toFixed(1)}%`);
        setText(`${labelPrefix}PeriodLabel`, labelPrefix === 'year' ? `Year ${label}` : label);
        setHTML(
            `${labelPrefix}FormulaText`,
            summary.marked > 0
                ? `<strong>${label} Attendance</strong> uses <strong>(${summary.attended} attended) / (${summary.marked} finalized days) × 100</strong>. Absent includes teacher-marked absences plus any completed unmarked days. Pending days are not counted yet.`
                : `<strong>${label} Attendance</strong> has no finalized days yet. The percentage stays at 0% until a day is completed or attendance is recorded.`
        );
        setText(`${labelPrefix}PresentCount`, summary.present);
        setText(`${labelPrefix}LateCount`, summary.late);
        setText(`${labelPrefix}AbsentCount`, summary.absent);
        setText(`${labelPrefix}AttendedCount`, summary.attended);
        setText(`${labelPrefix}MarkedCount`, summary.marked);
        setText(`${labelPrefix}PendingCount`, summary.pending);
    }

    function renderStudentAttendance() {
        if (!state.stats && !window.studentAttendanceStats) {
            return;
        }

        const monthInput = document.getElementById('attendanceMonthPicker');
        if (!monthInput) return;

        const monthValue = monthInput.value || currentMonthValue();
        const yearValue = yearFromMonth(monthValue);
        const history = state.history || [];
        const baselineDate = getBaselineDate(history);
        const finalizedThroughDate = getFinalizedThroughDate(history);
        const monthSummary = buildPeriodSummary(history, startOfMonth(monthValue), endOfMonth(monthValue), baselineDate, finalizedThroughDate);
        const yearPrefix = String(yearValue);
        const yearSummary = buildPeriodSummary(history, startOfYear(yearValue), endOfYear(yearValue), baselineDate, finalizedThroughDate);

        setText('attendanceCalendarMonthLabel', monthLabel(monthValue));
        setText('attendanceCalendarYearLabel', String(yearValue));
        setText('attendanceCalculationNote', `Present and Late count as attended. Absent includes teacher-marked absences and completed unmarked days. Pending days are visible in gray until the school day is finalized. Calculation window: ${formatDateOnly(baselineDate)} to ${formatDateOnly(finalizedThroughDate)}.`);

        renderCalendar(monthValue, history, baselineDate, finalizedThroughDate);
        renderSummaryCard(monthValue, monthSummary, 'month', monthLabel(monthValue));
        renderSummaryCard(yearPrefix, yearSummary, 'year', String(yearValue));
    }

    function applyStudentStats(stats) {
        state.stats = stats || null;
        state.history = Array.isArray(stats?.history) ? stats.history : (Array.isArray(window.studentAttendanceHistory) ? window.studentAttendanceHistory : []);
        renderStudentAttendance();
    }

    document.addEventListener('student-attendance-stats-loaded', (event) => {
        applyStudentStats(event.detail || window.studentAttendanceStats || null);
    });

    document.addEventListener('DOMContentLoaded', () => {
        const monthInput = document.getElementById('attendanceMonthPicker');
        if (monthInput && !monthInput.value) {
            monthInput.value = currentMonthValue();
        }

        monthInput?.addEventListener('change', () => {
            renderStudentAttendance();
        });

        if (window.studentAttendanceStats || window.studentAttendanceHistory) {
            applyStudentStats(window.studentAttendanceStats || { history: window.studentAttendanceHistory || [] });
        }

        renderStudentAttendance();
    });

    // --- Live Class Sessions Logic ---
    let activeSessionId = null;
    let cameraStream = null;

    async function fetchActiveSessions() {
        try {
            const { resp, data: sessions } = await window.Api.apiFetch('/timetable/active-sessions', { method: 'GET' });
            if (!resp.ok) throw new Error("Failed to fetch sessions");
            
            const container = document.getElementById('activeSessionsContainer');
            if (!container) return;

            if (sessions && sessions.length > 0) {
                const session = sessions[0];
                activeSessionId = session.id;
                
                let subjectText = session.subject;
                if (session.actual_start_time) {
                    const d = new Date(session.actual_start_time);
                    subjectText += ` (Started at ${pad(d.getHours())}:${pad(d.getMinutes())})`;
                }
                document.getElementById('liveSubject').textContent = subjectText;
                document.getElementById('liveTeacher').textContent = `Room: ${session.room_id}`; // Re-using element for room id
                
                // Show banner
                container.style.display = 'grid';
                container.innerHTML = `
                <div class="widget-card" style="margin-bottom: 24px; padding: 16px 24px; background: linear-gradient(90deg, rgba(0,209,199,0.2) 0%, rgba(0,0,0,0) 100%); border-left: 4px solid var(--primary); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="color: var(--primary); margin: 0 0 4px 0; font-size: 1.2rem;"><i class="fa-solid fa-broadcast-tower" style="animation: pulse 1s infinite;"></i> ONGOING SESSION</h3>
                        <p style="margin: 0; color: var(--text-primary); font-size: 1rem;"><strong>${session.subject}</strong> is ongoing in <strong>${session.room_id}</strong>.</p>
                    </div>
                </div>`;
            } else {
                container.style.display = 'none';
                activeSessionId = null;
            }
        } catch (error) {
            console.error("Failed to fetch active sessions:", error);
        }
    }

    const markAttendanceBtn = document.getElementById('markAttendanceBtn');
    const cameraModal = document.getElementById('cameraModal');
    const closeCameraModalBtn = document.getElementById('closeCameraModal');
    const studentVideo = document.getElementById('studentVideo');
    const cameraPlaceholder = document.getElementById('cameraPlaceholder');
    const captureFaceBtn = document.getElementById('captureFaceBtn');
    const cameraStatusText = document.getElementById('cameraStatusText');

    let currentLat = null;
    let currentLon = null;

    if (markAttendanceBtn) {
        markAttendanceBtn.addEventListener('click', async () => {
            cameraModal.style.display = 'flex';
            cameraStatusText.textContent = "Requesting GPS Location...";
            
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    currentLat = position.coords.latitude;
                    currentLon = position.coords.longitude;
                    cameraPlaceholder.querySelector('h4').textContent = "LOCATION VERIFIED";
                    cameraPlaceholder.querySelector('p').textContent = `LAT: ${currentLat.toFixed(4)} LON: ${currentLon.toFixed(4)}`;
                    
                    cameraStatusText.textContent = "Starting Camera...";
                    try {
                        cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
                        studentVideo.srcObject = cameraStream;
                        studentVideo.style.display = 'block';
                        cameraPlaceholder.style.display = 'none';
                        
                        captureFaceBtn.style.display = 'block';
                        captureFaceBtn.disabled = false;
                        cameraStatusText.textContent = "Ready to scan face.";
                    } catch (err) {
                        cameraStatusText.textContent = "Camera access denied or unavailable.";
                    }
                },
                (error) => {
                    cameraStatusText.textContent = "GPS Location denied or unavailable. Attendance requires location.";
                }
            );
        });
    }

    if (closeCameraModalBtn) {
        closeCameraModalBtn.addEventListener('click', () => {
            cameraModal.style.display = 'none';
            if (cameraStream) {
                cameraStream.getTracks().forEach(track => track.stop());
                cameraStream = null;
            }
            studentVideo.style.display = 'none';
            cameraPlaceholder.style.display = 'block';
            captureFaceBtn.style.display = 'none';
        });
    }

    if (captureFaceBtn) {
        captureFaceBtn.addEventListener('click', async () => {
            if (!activeSessionId || !currentLat || !currentLon) return;
            
            captureFaceBtn.disabled = true;
            captureFaceBtn.textContent = "PROCESSING...";
            
            const canvas = document.createElement('canvas');
            canvas.width = studentVideo.videoWidth;
            canvas.height = studentVideo.videoHeight;
            canvas.getContext('2d').drawImage(studentVideo, 0, 0);
            const imageBase64 = canvas.toDataURL('image/jpeg');

            const roomCode = prompt("Enter the room code provided by the teacher:");
            if (!roomCode) {
                captureFaceBtn.disabled = false;
                captureFaceBtn.textContent = "CAPTURE & VERIFY";
                return;
            }

            try {
                const { resp, data } = await window.Api.apiFetch('/student/attendance/self-mark', {
                    method: 'POST',
                    body: {
                        session_id: activeSessionId,
                        room_code: roomCode,
                        image: imageBase64,
                        latitude: currentLat,
                        longitude: currentLon
                    }
                });
                
                if (!resp.ok) {
                    throw new Error(data.detail || data.message || "Failed to mark attendance.");
                }
                
                alert("Attendance Marked Successfully!");
                closeCameraModalBtn.click();
                
                // Refresh data (simulate click on nav or refresh window)
                window.location.reload();
            } catch (err) {
                alert(err.message || "Failed to mark attendance.");
                captureFaceBtn.disabled = false;
                captureFaceBtn.textContent = "SCAN FACE & MARK PRESENT";
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        fetchActiveSessions();
        setInterval(fetchActiveSessions, 30000); 
    });

})();

async function checkTimetableBanner() {
    try {
        const {resp, data} = await window.Api.apiFetch('/timetable/today');
        const container = document.getElementById('timetableBannerContainer');
        if(!container || !data || data.length === 0) return;
        
        const now = new Date();
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();
        const currentTime = currentHour * 60 + currentMin;
        
        let activeClass = null;
        for(const tt of data) {
            const [sh, sm] = tt.start_time.split(':').map(Number);
            const [eh, em] = tt.end_time.split(':').map(Number);
            const startMins = sh * 60 + sm;
            const endMins = eh * 60 + em;
            
            // Allow 15 mins before to show banner
            if(currentTime >= (startMins - 15) && currentTime <= endMins) {
                activeClass = tt;
                break;
            }
        }
        
        if(activeClass) {
            container.innerHTML = `
                <div class="widget-card" style="margin-bottom: 24px; padding: 16px 24px; background: linear-gradient(90deg, rgba(0,209,199,0.1) 0%, rgba(0,0,0,0) 100%); border-left: 4px solid var(--primary); display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h3 style="color: var(--primary); margin: 0 0 4px 0;"><i class="fa-solid fa-calendar"></i> Timetable Reminder</h3>
                        <p style="margin: 0; color: var(--text-dim); font-size: 0.9rem;">You have <strong>${activeClass.subject}</strong> with ${activeClass.teacher_name} from ${activeClass.start_time} to ${activeClass.end_time}. Wait for the teacher to start the session below to mark attendance.</p>
                    </div>
                </div>
            `;
        } else {
            container.innerHTML = '';
        }
    } catch(e) {
        console.error("Timetable fetch failed", e);
    }
}
