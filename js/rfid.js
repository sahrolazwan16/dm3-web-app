/* ============================================================
   DM3 MANAGEMENT SYSTEM
   RFID.JS V1.6 FULL + JAWATAN
   Kehadiran RFID - Persatuan Penduduk Desa Mentari 3

   CIRI:
   - Web Serial API (USB Reader)
   - HID Scanner (keyboard wedge) support
   - Futuristic Fullscreen Live Scan Screen
   - RFID Test Mode
   - Manual Attendance
   - Auto load Programs & Members
   - AJK papar gambar, Ahli biasa papar icon
   - Scan Terkini dengan status duplicate + JAWATAN
   - Jumlah Hadir dari attendance sebenar
   - Duplicate scan DIAM TERUS (tanpa toast)
   - Debounced refresh attendance
   - History scan KEKAL walaupun tutup/buka Live Scan
   - Simpan program terakhir dalam localStorage
   - Auto rebuild sidebar dari data server
   - Live Clock (Masa & Tarikh Sebenar)
   - EXPORT CSV / WHATSAPP / EMAIL dengan JAWATAN
============================================================ */

(function () {
    "use strict";

    console.log("========================================");
    console.log("DM3 RFID.JS V1.6 FULL + JAWATAN");
    console.log("========================================");

    /* ==========================================================
       CONFIG
    ========================================================== */

    const RFID_CONFIG = {
        getProgramsAction: "getPrograms",
        getMembersAction: "getMembers",
        getAttendanceAction: "getAttendance",
        recordAttendanceAction: "recordAttendance",
        addAttendanceAction: "addAttendanceManual",
        scanCooldownMs: 1500,
        serialBaudRate: 9600,
        storageKeyProgram: "DM3_RFID_PROGRAM"
    };

    /* ==========================================================
       STATE
    ========================================================== */

    const RFID_STATE = {
        initialized: false,
        connected: false,
        port: null,
        reader: null,
        readLoopActive: false,
        serialBuffer: "",
        lastUID: "",
        lastScanAt: 0,
        selectedProgramId: "",
        programs: [],
        members: [],
        attendance: [],
        testMode: false
    };

    let attendanceRefreshTimer = null;

    /* ==========================================================
       HELPERS
    ========================================================== */

    function $(id) {
        return document.getElementById(id);
    }

    function escapeHTML(value) {
        if (value === null || value === undefined) return "";
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function showToast(message, type) {
        if (typeof window.showToast === "function") {
            window.showToast(message, type || "info");
            return;
        }
        console.log("[RFID TOAST]", message);
    }

    function showLoading(message) {
        if (typeof window.showLoading === "function") {
            window.showLoading(message);
        }
    }

    function hideLoading() {
        if (typeof window.hideLoading === "function") {
            window.hideLoading();
        }
    }

    async function apiRequest(action, data) {
        data = data || {};

        if (typeof window.dm3ApiRequest === "function") {
            return await window.dm3ApiRequest(action, data);
        }
        if (typeof window.apiRequest === "function") {
            return await window.apiRequest(action, data);
        }
        if (window.DM3_API && typeof window.DM3_API.request === "function") {
            return await window.DM3_API.request(action, data);
        }
        if (window.DM3_APP && typeof window.DM3_APP.request === "function") {
            return await window.DM3_APP.request(action, data);
        }

        throw new Error("API DM3 tidak dijumpai.");
    }

    function formatTimeNow() {
        const n = new Date();
        return String(n.getHours()).padStart(2, "0") + ":" +
               String(n.getMinutes()).padStart(2, "0") + ":" +
               String(n.getSeconds()).padStart(2, "0");
    }

    /* ==========================================================
       FUNGSI ASAL — Cari ahli berdasarkan UID sahaja
    ========================================================== */
    function findMemberByUid(uid) {
        return RFID_STATE.members.find(function (m) {
            const mUid = m.uidRfid || m["UID RFID"] || m.uid || m["UID"] || "";
            return String(mUid).trim().toUpperCase() === String(uid).trim().toUpperCase();
        });
    }

    /* ==========================================================
       FUNGSI BARU — Dapatkan jawatan dari record atau members
       Digunakan untuk Scan Terkini, CSV, WhatsApp, Email
    ========================================================== */
    function getMemberJawatan(record) {
        if (!record) return "Ahli";

        // Cuba cari jawatan dari record dulu
        let jawatan = String(
            record.jawatan || record.Jawatan || ""
        ).trim();

        if (jawatan) {
            return jawatan;
        }

        // Jika tiada, cari dari RFID_STATE.members
        if (!Array.isArray(RFID_STATE.members)) {
            return "Ahli";
        }

        const ahliId = String(record.ahliId || "").trim();
        const uid = String(record.uidRfid || record["UID RFID"] || "").trim();

        const member = RFID_STATE.members.find(function (m) {
            const mId = String(m.id || m.ID || "").trim();
            const mUid = String(m.uidRfid || m["UID RFID"] || "").trim();
            return (ahliId && mId === ahliId) || (uid && mUid === uid);
        });

        if (member) {
            jawatan = String(member.jawatan || member.Jawatan || "").trim();
        }

        return jawatan || "Ahli";
    }

    /* ==========================================================
       SEMAK JIKA SUDAH DIREKODKAN UNTUK PROGRAM SEMASA
    ========================================================== */

    function isAlreadyRecorded(uid, memberId) {
        if (!Array.isArray(RFID_STATE.attendance)) return false;

        const targetUid = String(uid || "").trim().toUpperCase();
        const targetId = String(memberId || "").trim();

        return RFID_STATE.attendance.some(function (record) {
            const recUid = String(record.uidRfid || "").trim().toUpperCase();
            const recAhliId = String(record.ahliId || "").trim();

            if (targetUid && recUid === targetUid) return true;
            if (targetId && recAhliId === targetId) return true;

            return false;
        });
    }

    /* ==========================================================
       CONVERT GOOGLE DRIVE URL
    ========================================================== */

    function convertDriveUrlRFID(url) {
        if (!url) return "";

        let s = String(url).trim();

        if (s.indexOf("drive.google.com") === -1 &&
            s.indexOf("googleusercontent.com") === -1) {
            return s;
        }

        let fileId = "";

        let m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m) fileId = m[1];

        if (!fileId) {
            m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
            if (m) fileId = m[1];
        }

        if (!fileId) {
            m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
            if (m) fileId = m[1];
        }

        if (fileId) {
            return "https://drive.google.com/thumbnail?id=" +
                   fileId + "&sz=w1000";
        }

        return s;
    }

    /* ==========================================================
       CHECK JIKA MEMBER ADALAH AJK
    ========================================================== */

    function isMemberAJK(member) {
        if (!member) return false;

        const jawatan = String(
            member.jawatan || member.Jawatan || ""
        ).trim().toLowerCase();

        if (!jawatan) return false;

        if (jawatan === "ahli" ||
            jawatan === "anggota" ||
            jawatan === "member") {
            return false;
        }

        return true;
    }

    /* ==========================================================
       STATUS BADGE
    ========================================================== */

    function updateStatusBadge(connected) {
        RFID_STATE.connected = Boolean(connected);

        const badge = $("rfidStatusBadge");
        const msg = $("rfidReaderMessage");

        if (badge) {
            if (RFID_STATE.connected) {
                badge.classList.add("connected");
                badge.innerHTML = '<i class="fa-solid fa-circle"></i> CONNECTED';
            } else {
                badge.classList.remove("connected");
                badge.innerHTML = '<i class="fa-solid fa-circle"></i> DISCONNECTED';
            }
        }

        if (msg) {
            msg.textContent = RFID_STATE.connected
                ? "Reader sedia. Sila scan kad RFID."
                : "Reader belum disambungkan. Guna HID scanner atau klik Connect Serial.";
        }

        if (window.DM3_STATE) {
            window.DM3_STATE.rfidConnected = RFID_STATE.connected;
        }
    }

    /* ==========================================================
       WEB SERIAL API
    ========================================================== */

    async function connectSerialReader() {
        if (!("serial" in navigator)) {
            showToast("Browser tidak menyokong Web Serial. Guna Chrome/Edge.", "error");
            return;
        }

        try {
            const port = await navigator.serial.requestPort();
            await port.open({ baudRate: RFID_CONFIG.serialBaudRate });

            RFID_STATE.port = port;
            updateStatusBadge(true);
            showToast("Reader berjaya disambungkan.", "success");

            readSerialLoop(port);
        } catch (error) {
            console.error("[RFID] CONNECT ERROR:", error);
            showToast("Gagal sambung reader: " + error.message, "error");
            updateStatusBadge(false);
        }
    }

    async function readSerialLoop(port) {
        RFID_STATE.readLoopActive = true;
        RFID_STATE.serialBuffer = "";

        const decoder = new TextDecoderStream();
        const readableClosed = port.readable.pipeTo(decoder.writable).catch(function () {});
        const reader = decoder.readable.getReader();
        RFID_STATE.reader = reader;

        try {
            while (RFID_STATE.readLoopActive) {
                const result = await reader.read();
                if (result.done) break;
                if (result.value) {
                    handleSerialChunk(result.value);
                }
            }
        } catch (error) {
            console.warn("[RFID] READ LOOP ERROR:", error);
        } finally {
            try { reader.releaseLock(); } catch (e) {}
            try { await readableClosed; } catch (e) {}
            RFID_STATE.readLoopActive = false;
        }
    }

    function handleSerialChunk(text) {
        RFID_STATE.serialBuffer += text;

        const lines = RFID_STATE.serialBuffer.split(/[\r\n]+/);
        RFID_STATE.serialBuffer = lines.pop() || "";

        lines.forEach(function (line) {
            const uid = line.trim();
            if (uid) {
                handleUIDScanned(uid);
            }
        });
    }

    /* ==========================================================
       HID SCANNER (keyboard wedge)
    ========================================================== */

    function bindHIDScanner() {
        const input = $("rfid-hidden-input");
        if (!input) return;

        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                const uid = input.value.trim();
                input.value = "";
                if (uid) {
                    handleUIDScanned(uid);
                }
            }
        });

        document.addEventListener("click", function (event) {
            const page = $("page-rfid");
            const liveScan = $("liveScanScreen");
            const isLiveScanOpen = liveScan && !liveScan.classList.contains("hidden");

            if (!isLiveScanOpen && (!page || !page.contains(event.target))) return;

            const tag = (event.target.tagName || "").toUpperCase();

            if (
                tag === "SELECT" ||
                tag === "OPTION" ||
                tag === "INPUT" ||
                tag === "TEXTAREA" ||
                tag === "BUTTON" ||
                tag === "LABEL" ||
                event.target.closest(".modal-dialog") ||
                event.target.closest("#rfidProgramSelect") ||
                event.target.closest("#liveScanProgramSelect")
            ) {
                return;
            }

            setTimeout(function () {
                try { input.focus(); } catch (e) {}
            }, 50);

            setInterval(function () {
                const liveScan = $("liveScanScreen");
                const isLiveScanOpen = liveScan && !liveScan.classList.contains("hidden");

                if (isLiveScanOpen && document.activeElement !== input) {
                    try {
                        input.focus();
                    } catch (e) {}
                }
            }, 500);
        });
    }

    /* ==========================================================
       HANDLE UID SCAN
    ========================================================== */

    function handleUIDScanned(uid) {
        if (!uid) return;

        const now = Date.now();

        if (uid === RFID_STATE.lastUID && (now - RFID_STATE.lastScanAt) < RFID_CONFIG.scanCooldownMs) {
            return;
        }
        RFID_STATE.lastUID = uid;
        RFID_STATE.lastScanAt = now;

        console.log("[RFID] UID SCANNED:", uid);

        const liveScanModal = $("liveScanScreen");
        const isLiveScan = liveScanModal && !liveScanModal.classList.contains("hidden");

        const member = findMemberByUid(uid);
        const timeStr = formatTimeNow();

        if (RFID_STATE.testMode) {
            showToast("Test Mode: UID " + uid + " diterima.", "info");
            return;
        }

        if (member && RFID_STATE.selectedProgramId && isAlreadyRecorded(uid, member.id)) {
            console.log("[RFID] Sudah direkodkan untuk program ini — diabaikan.");
            return;
        }

        if (isLiveScan) {
            if (!member) {
                showLiveScanMember(null, uid, "unknown", "Kad tidak didaftarkan");
                addRecentScan(null, uid, timeStr, false);
                return;
            }

            showLiveScanMember(member, uid, "success", "");

            recordAttendance(uid, false).then(function (result) {
                if (result && result.duplicate) {
                    const statusEl = $("liveScanStatus");
                    if (statusEl) {
                        statusEl.className = "scan-status warning";
                        statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> SUDAH DIREKODKAN';
                    }
                    addRecentScan(member, uid, timeStr, true);
                } else if (result && result.success) {
                    addRecentScan(member, uid, timeStr, false);
                    scheduleAttendanceRefresh();
                }
            });
        } else {
            showScanResult(uid);
            recordAttendance(uid, false);
        }
    }

    function showScanResult(uid) {
        const box = $("scanResult");
        const nameEl = $("scanResultName");
        const detailEl = $("scanResultDetails");

        if (!box) return;

        const member = findMemberByUid(uid);

        box.classList.remove("hidden");

        if (member) {
            const nama = member.nama || member.Nama || "-";
            const rumah = member.noRumah || member["No Rumah"] || "-";
            const jawatan = member.jawatan || member.Jawatan || "Ahli";
            if (nameEl) nameEl.textContent = nama;
            if (detailEl) detailEl.textContent = "UID: " + uid + " | Rumah: " + rumah + " | " + jawatan;
        } else {
            if (nameEl) nameEl.textContent = "UID Tidak Dikenali";
            if (detailEl) detailEl.textContent = "UID: " + uid;
        }
    }

    /* ==========================================================
       RECORD ATTENDANCE
    ========================================================== */

    async function recordAttendance(uid, silentMode) {
        if (!RFID_STATE.selectedProgramId) {
            if (!silentMode) showToast("Sila pilih program dahulu.", "warning");
            return { success: false, message: "Tiada program dipilih." };
        }

        try {
            const response = await apiRequest(RFID_CONFIG.recordAttendanceAction, {
                uid: uid,
                programId: RFID_STATE.selectedProgramId,
                timestamp: new Date().toISOString()
            });

            if (response && response.success) {
                if (!silentMode) {
                    showToast(response.message || "Kehadiran direkodkan.", "success");
                }

                if (response.data && !response.data.duplicate) {
                    RFID_STATE.attendance.push({
                        ahliId: response.data.ahliId || "",
                        uidRfid: response.data.uidRfid || uid,
                        nama: response.data.nama || "",
                        noRumah: response.data.noRumah || "",
                        jawatan: response.data.jawatan || "",
                        masa: response.data.masa || formatTimeNow()
                    });
                    updateLiveScanCount();
                }

                return {
                    success: true,
                    duplicate: Boolean(response.data && response.data.duplicate),
                    message: response.message
                };
            } else {
                if (!silentMode) {
                    showToast((response && response.message) || "Gagal rekod kehadiran.", "error");
                }
                return { success: false, message: response && response.message };
            }
        } catch (error) {
            console.error("[RFID] RECORD ERROR:", error);
            if (!silentMode) {
                showToast("Ralat rekod kehadiran: " + error.message, "error");
            }
            return { success: false, message: error.message };
        }
    }

    /* ==========================================================
       DEBOUNCED REFRESH ATTENDANCE
    ========================================================== */

    function scheduleAttendanceRefresh() {
        if (attendanceRefreshTimer) {
            clearTimeout(attendanceRefreshTimer);
        }

        attendanceRefreshTimer = setTimeout(function () {
            attendanceRefreshTimer = null;
            if (RFID_STATE.selectedProgramId) {
                loadAttendanceForProgram(RFID_STATE.selectedProgramId, true);
            }
        }, 5000);
    }

    /* ==========================================================
       LOAD PROGRAMS
    ========================================================== */

    async function loadPrograms() {
        try {
            const response = await apiRequest(RFID_CONFIG.getProgramsAction, {});

            if (response && response.success && Array.isArray(response.data)) {
                RFID_STATE.programs = response.data;
                populateProgramSelect();
            }
        } catch (error) {
            console.error("[RFID] LOAD PROGRAMS ERROR:", error);
        }
    }

    function populateProgramSelect() {
        const select = $("rfidProgramSelect");
        if (!select) return;

        const currentValue = select.value;

        select.innerHTML = '<option value="">-- Pilih Program --</option>';

        RFID_STATE.programs.forEach(function (program) {
            const opt = document.createElement("option");
            opt.value = program.id || program.ID || "";
            opt.textContent = program.nama || program.namaProgram || program.Nama || "Program";
            select.appendChild(opt);
        });

        if (currentValue) {
            select.value = currentValue;
        }
    }

    /* ==========================================================
       LOAD MEMBERS
    ========================================================== */

    async function loadMembers() {
        try {
            if (window.DM3_STATE && Array.isArray(window.DM3_STATE.members) && window.DM3_STATE.members.length) {
                RFID_STATE.members = window.DM3_STATE.members;
                return;
            }

            const response = await apiRequest(RFID_CONFIG.getMembersAction, {});
            if (response && response.success && Array.isArray(response.data)) {
                RFID_STATE.members = response.data;
            }
        } catch (error) {
            console.error("[RFID] LOAD MEMBERS ERROR:", error);
        }
    }

    /* ==========================================================
       LOAD ATTENDANCE FOR PROGRAM
    ========================================================== */

    async function loadAttendanceForProgram(programId, silent) {

        const container = $("attendanceTableContainer");

        if (!container) {
            console.warn("[RFID] attendanceTableContainer tidak dijumpai.");
            return;
        }

        console.log("[RFID] Load attendance untuk program:", programId);

        if (!programId) {
            container.innerHTML = `
                <div style="text-align:center;padding:30px;color:#94a3b8;">
                    <i class="fa-solid fa-list-check" style="font-size:32px;opacity:.4;display:block;margin-bottom:10px;"></i>
                    Sila pilih program untuk melihat senarai kehadiran.
                </div>
            `;
            return;
        }

        if (!silent) {
            container.innerHTML = `
                <div style="text-align:center;padding:30px;color:#94a3b8;">
                    <i class="fa-solid fa-spinner fa-spin" style="font-size:24px;display:block;margin-bottom:10px;"></i>
                    Memuatkan...
                </div>
            `;
        }

        try {

            const response = await apiRequest(RFID_CONFIG.getAttendanceAction, {
                programId: programId
            });

            console.log("[RFID] Attendance response:", response);

            if (!response || !response.success) {
                container.innerHTML = `
                    <div style="text-align:center;padding:30px;color:#dc2626;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size:24px;display:block;margin-bottom:10px;"></i>
                        ${escapeHTML(response && response.message ? response.message : "Gagal memuatkan data.")}
                    </div>
                `;
                return;
            }

            if (!Array.isArray(response.data)) {
                container.innerHTML = `
                    <div style="text-align:center;padding:30px;color:#dc2626;">
                        Data tidak sah.
                    </div>
                `;
                return;
            }

            RFID_STATE.attendance = response.data;
            updateLiveScanCount();
            rebuildScanSidebar(RFID_STATE.attendance);

            if (response.data.length === 0) {
                container.innerHTML = `
                    <div style="text-align:center;padding:30px;color:#64748b;">
                        <i class="fa-solid fa-user-slash" style="font-size:28px;opacity:.4;display:block;margin-bottom:10px;"></i>
                        Tiada rekod kehadiran untuk program ini.
                    </div>
                `;
                return;
            }

            let programName = programId;
            const program = RFID_STATE.programs.find(function (p) {
                return String(p.id || p.ID || "") === String(programId);
            });

            if (program) {
                programName = program.nama || program.namaProgram || program.Nama || programId;
            }

            let html = `
                <div style="display:flex;flex-direction:column;height:100%;">
                    
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(135deg,#eff6ff,#dbeafe);border-bottom:1px solid #e5eaf1;border-radius:12px 12px 0 0;margin-bottom:12px;">
                        <div style="display:flex;align-items:center;gap:10px;">
                            <div style="width:32px;height:32px;background:linear-gradient(135deg,#3b82f6,#2563eb);border-radius:8px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:14px;">
                                <i class="fa-solid fa-calendar-check"></i>
                            </div>
                            <div>
                                <div style="font-weight:800;color:#0f172a;font-size:13px;">${escapeHTML(programName)}</div>
                                <div style="font-size:11px;color:#64748b;margin-top:2px;">Senarai kehadiran</div>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:6px;padding:5px 12px;background:#2563eb;color:#fff;border-radius:999px;font-size:12px;font-weight:800;">
                            <i class="fa-solid fa-users" style="font-size:10px;"></i>
                            ${response.data.length}
                        </div>
                    </div>

                    <div style="display:flex;flex-direction:column;gap:8px;max-height:400px;overflow-y:auto;padding-right:4px;">
            `;

            response.data.forEach(function (row, i) {

                const nama = row.nama || row.Nama || "-";
                const rumah = row.noRumah || row["No Rumah"] || row["No. Rumah"] || "-";
                const masa = row.masa || row.Masa || row.timestamp || "-";
                const uid = row.uidRfid || row["UID RFID"] || "";

                const member = RFID_STATE.members.find(function (m) {
                    const mId = String(m.id || m.ID || "").trim();
                    const mUid = String(m.uidRfid || m["UID RFID"] || "").trim();
                    const rowAhliId = String(row.ahliId || "").trim();
                    return (rowAhliId && mId === rowAhliId) || (uid && mUid === uid);
                });

                // Guna getMemberJawatan untuk dapatkan jawatan
                const jawatan = getMemberJawatan(row);

                const isAJK = jawatan &&
                              jawatan.toLowerCase() !== "ahli" &&
                              jawatan.toLowerCase() !== "anggota" &&
                              jawatan.toLowerCase() !== "member";

                const photoSrc = member && isAJK
                    ? (member.gambar || member.gambarUrl || member.image || "")
                    : "";

                const photo = photoSrc
                    ? `<img src="${escapeHTML(convertDriveUrlRFID(photoSrc))}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid #00ff88;flex-shrink:0;">`
                    : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#e0f2fe,#bae6fd);display:flex;align-items:center;justify-content:center;color:#0284c7;font-size:14px;flex-shrink:0;"><i class="fa-solid fa-user-tie"></i></div>`;

                html += `
                    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;background:#ffffff;border:1px solid #e5eaf1;border-radius:10px;">

                        <div style="min-width:26px;height:26px;background:#2563eb;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">
                            ${i + 1}
                        </div>

                        ${photo}

                        <div style="flex:1;min-width:0;">
                            <div style="font-weight:700;color:#1e293b;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                ${escapeHTML(nama)}
                            </div>
                            <div style="font-size:11px;color:#64748b;margin-top:2px;">
                                <i class="fa-solid fa-house" style="font-size:9px;margin-right:4px;"></i>${escapeHTML(rumah)}
                                ${jawatan ? ` • <span style="color:#00ff88;font-weight:700;">${escapeHTML(jawatan)}</span>` : ""}
                            </div>
                        </div>

                        <div style="font-size:11px;color:#475569;font-weight:700;font-family:ui-monospace,monospace;white-space:nowrap;">
                            <i class="fa-solid fa-clock" style="font-size:9px;margin-right:4px;color:#94a3b8;"></i>${escapeHTML(masa)}
                        </div>

                    </div>
                `;
            });

            html += `
                    </div>
                </div>
            `;

            container.innerHTML = html;

            console.log("[RFID] Attendance rendered:", response.data.length, "rekod.");

        } catch (error) {

            console.error("[RFID] LOAD ATTENDANCE ERROR:", error);

            container.innerHTML = `
                <div style="text-align:center;padding:30px;color:#dc2626;">
                    <i class="fa-solid fa-triangle-exclamation" style="font-size:24px;display:block;margin-bottom:10px;"></i>
                    Ralat memuatkan kehadiran.
                </div>
            `;
        }
    }

    /* ==========================================================
       UPDATE JUMLAH HADIR
    ========================================================== */

    function updateLiveScanCount() {
        const countEl = $("liveScanCount");
        if (!countEl) return;

        const seen = {};
        let uniqueCount = 0;

        if (Array.isArray(RFID_STATE.attendance)) {
            RFID_STATE.attendance.forEach(function (record) {
                const ahliId = String(
                    record.ahliId ||
                    record.uidRfid ||
                    ''
                ).trim();

                if (ahliId && !seen[ahliId]) {
                    seen[ahliId] = true;
                    uniqueCount++;
                }
            });
        }

        countEl.textContent = String(uniqueCount);
    }

    /* ==========================================================
       LIVE SCAN MODAL
    ========================================================== */

    function openLiveScan() {
        const modal = $("liveScanScreen");
        if (!modal) return;

        if (!RFID_STATE.selectedProgramId) {
            showToast("Sila pilih program dahulu sebelum scan.", "warning");
            return;
        }

        const liveSelect = $("liveScanProgramSelect");
        if (liveSelect) {
            liveSelect.innerHTML = '<option value="">-- Pilih Program --</option>';
            RFID_STATE.programs.forEach(function (p) {
                const opt = document.createElement("option");
                opt.value = p.id || p.ID || "";
                opt.textContent = p.nama || p.namaProgram || p.Nama || "Program";
                liveSelect.appendChild(opt);
            });
            liveSelect.value = RFID_STATE.selectedProgramId || "";
        }

        const idle = $("scanIdle");
        const result = $("scanResultCard");
        if (idle) idle.classList.remove("hidden");
        if (result) result.classList.add("hidden");

        modal.classList.remove("hidden");
        document.body.style.overflow = "hidden";

        if (window.DM3_SCAN_CLOCK) {
            window.DM3_SCAN_CLOCK.start();
        }

        try {
            const el = document.documentElement;
            if (el.requestFullscreen && !document.fullscreenElement) {
                el.requestFullscreen().catch(function () {});
            }
        } catch (e) {}

        if (RFID_STATE.selectedProgramId) {
            loadAttendanceForProgram(RFID_STATE.selectedProgramId, true);
        }

        const hiddenInput = $("rfid-hidden-input");
        if (hiddenInput) {
            setTimeout(function () {
                try {
                    hiddenInput.removeAttribute("readonly");
                    hiddenInput.focus();

                    setTimeout(function () {
                        try {
                            hiddenInput.setAttribute("readonly", "readonly");
                        } catch (e) {}
                    }, 100);
                } catch (e) {}
            }, 200);
        }
    }

    function closeLiveScan() {
        const modal = $("liveScanScreen");
        if (!modal) return;

        modal.classList.add("hidden");
        document.body.style.overflow = "";

        if (window.DM3_SCAN_CLOCK) {
            window.DM3_SCAN_CLOCK.stop();
        }

        try {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(function () {});
            }
        } catch (e) {}

        console.log("[RFID] Live Scan closed. History disimpan.");
    }

    function resetLiveScanUI() {
        const idle = $("scanIdle");
        const result = $("scanResultCard");
        const recentList = $("scanRecentList");
        const countEl = $("liveScanCount");

        if (idle) idle.classList.remove("hidden");
        if (result) result.classList.add("hidden");
        if (recentList) {
            recentList.innerHTML =
                '<div class="scan-empty">Tiada scan lagi.</div>';
        }
        if (countEl) countEl.textContent = "0";

        RFID_STATE.attendance = [];
    }

    function toggleLiveScanFullscreen() {
        try {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(function () {});
            } else {
                document.documentElement.requestFullscreen().catch(function () {});
            }
        } catch (e) {}
    }

    function showLiveScanMember(member, uid, status, message) {
        const idle = $("scanIdle");
        const result = $("scanResultCard");

        if (idle) idle.classList.add("hidden");
        if (result) result.classList.remove("hidden");

        if (status === "success") {
            playWelcomeSound();
        }

        const photo = $("liveScanPhoto");
        const photoPlaceholder = $("liveScanPhotoPlaceholder");

        const memberIsAJK = isMemberAJK(member);

        const memberPhotoRaw = member && memberIsAJK
            ? (member.gambar || member.gambarUrl || member.image || "")
            : "";

        const memberPhoto = memberPhotoRaw
            ? convertDriveUrlRFID(memberPhotoRaw)
            : "";

        if (photo && photoPlaceholder) {
            if (memberPhoto) {
                photo.src = memberPhoto;
                photo.style.display = "block";
                photoPlaceholder.style.display = "none";
            } else {
                photo.style.display = "none";
                photoPlaceholder.style.display = "flex";
            }
        }

        const nameEl = $("liveScanName");
        const posEl = $("liveScanPosition");
        const houseEl = $("liveScanHouse");
        const timeEl = $("liveScanTime");
        const uidEl = $("liveScanUid");
        const statusEl = $("liveScanStatus");

        const timeStr = formatTimeNow();

        if (nameEl) nameEl.textContent = member ? (member.nama || member.Nama || "-") : "UID TIDAK DIKENALI";
        if (posEl) posEl.textContent = member ? (member.jawatan || "Ahli") : "TIADA DALAM SISTEM";
        if (houseEl) houseEl.textContent = member ? (member.noRumah || "-") : "-";
        if (timeEl) timeEl.textContent = timeStr;
        if (uidEl) uidEl.textContent = uid || "-";

        if (statusEl) {
            statusEl.className = "scan-status";
            if (status === "success") {
                statusEl.innerHTML = '<i class="fa-solid fa-circle-check"></i> HADIR DIREKODKAN';
            } else if (status === "duplicate") {
                statusEl.classList.add("warning");
                statusEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> SUDAH DIREKODKAN';
            } else {
                statusEl.classList.add("danger");
                statusEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> TIDAK DIDAFTARKAN';
            }
        }

        clearTimeout(window.__DM3_LIVE_SCAN_RESET);

        if (result) {
            result.classList.remove("scan-exiting");
        }

        window.__DM3_LIVE_SCAN_RESET = setTimeout(function () {

            if (result) {
                result.classList.add("scan-exiting");
            }

            setTimeout(function () {

                if (idle) idle.classList.remove("hidden");
                if (result) {
                    result.classList.add("hidden");
                    result.classList.remove("scan-exiting");
                }

            }, 2000);

        }, 8000);
    }

    /* ==========================================================
       ADD RECENT SCAN (Sidebar) — DENGAN JAWATAN
    ========================================================== */

    function addRecentScan(member, uid, timeStr, isDuplicate) {
        const list = $("scanRecentList");
        if (!list) return;

        const empty = list.querySelector(".scan-empty");
        if (empty) empty.remove();

        const item = document.createElement("div");
        item.className = "scan-recent-item";

        if (isDuplicate) {
            item.style.borderLeftColor = "#ffc800";
        }

        const memberIsAJK = isMemberAJK(member);

        const photoSrc = member && memberIsAJK
            ? (member.gambar || member.gambarUrl || member.image || "")
            : "";

        const photo = photoSrc
            ? '<img class="scan-recent-photo" src="' +
              escapeHTML(convertDriveUrlRFID(photoSrc)) + '" alt="">'
            : '<div class="scan-recent-photo-placeholder">' +
              '<i class="fa-solid fa-user-tie"></i></div>';

        const nama = member
            ? (member.nama || member.Nama || "-")
            : "UID: " + uid;

        // ==========================================================
        // JAWATAN
        // ==========================================================
        let jawatan = "";

        if (member) {
            jawatan = String(member.jawatan || member.Jawatan || "").trim();
        }

        if (!jawatan) {
            jawatan = member ? "Ahli" : "Tiada dalam sistem";
        }
        // ==========================================================

        const badge = isDuplicate
            ? '<i class="fa-solid fa-triangle-exclamation" ' +
              'style="color:#ffc800;margin-left:6px;font-size:11px;"></i>'
            : '<i class="fa-solid fa-circle-check" ' +
              'style="color:#00ff88;margin-left:6px;font-size:11px;"></i>';

        item.innerHTML = photo +
            '<div class="scan-recent-info">' +
                '<div class="scan-recent-name">' +
                    escapeHTML(nama) + badge +
                '</div>' +
                '<div class="scan-recent-meta">' +
                    '<span style="color:#00ff88;font-weight:700;">' +
                        escapeHTML(jawatan) +
                    '</span>' +
                    ' • ' + timeStr +
                '</div>' +
            '</div>';

        list.insertBefore(item, list.firstChild);

        while (list.children.length > 20) {
            list.removeChild(list.lastChild);
        }

        updateLiveScanCount();
    }

    /* ==========================================================
       REBUILD SCAN SIDEBAR DARI DATA SERVER — DENGAN JAWATAN
    ========================================================== */

    function rebuildScanSidebar(attendanceList) {
        const list = $("scanRecentList");
        if (!list) return;

        if (!Array.isArray(attendanceList) || attendanceList.length === 0) {
            list.innerHTML = '<div class="scan-empty">Tiada scan lagi.</div>';
            return;
        }

        list.innerHTML = "";

        const sorted = attendanceList.slice().reverse();

        sorted.forEach(function (record) {
            const ahliId = String(record.ahliId || "").trim();
            const uid = String(record.uidRfid || "").trim();
            const nama = String(record.nama || record.Nama || "-").trim();
            const masa = String(record.masa || record.Masa || record.timestamp || "-").trim();

            const member = RFID_STATE.members.find(function (m) {
                const mId = String(m.id || m.ID || "").trim();
                const mUid = String(m.uidRfid || m["UID RFID"] || "").trim();
                return (ahliId && mId === ahliId) || (uid && mUid === uid);
            });

            const item = document.createElement("div");
            item.className = "scan-recent-item";

            // ==========================================================
            // GUNA FUNGSI BARU getMemberJawatan
            // ==========================================================
            const jawatan = getMemberJawatan(record);
            // ==========================================================

            const isAJK = jawatan &&
                          jawatan.toLowerCase() !== "ahli" &&
                          jawatan.toLowerCase() !== "anggota" &&
                          jawatan.toLowerCase() !== "member";

            const photoSrc = member && isAJK
                ? (member.gambar || member.gambarUrl || member.image || "")
                : "";

            const photo = photoSrc
                ? '<img class="scan-recent-photo" src="' +
                  escapeHTML(convertDriveUrlRFID(photoSrc)) + '" alt="">'
                : '<div class="scan-recent-photo-placeholder">' +
                  '<i class="fa-solid fa-user-tie"></i></div>';

            const badge = '<i class="fa-solid fa-circle-check" ' +
                          'style="color:#00ff88;margin-left:6px;font-size:11px;"></i>';

            item.innerHTML = photo +
                '<div class="scan-recent-info">' +
                    '<div class="scan-recent-name">' +
                        escapeHTML(nama) + badge +
                    '</div>' +
                    '<div class="scan-recent-meta">' +
                        '<span style="color:#00ff88;font-weight:700;">' +
                            escapeHTML(jawatan) +
                        '</span>' +
                        ' • ' + escapeHTML(masa) +
                    '</div>' +
                '</div>';

            list.appendChild(item);
        });

        updateLiveScanCount();

        console.log("[RFID] Sidebar rebuilt:", sorted.length, "rekod.");
    }

    /* ==========================================================
       RFID TEST MODE
    ========================================================== */

    function openTestPanel() {
        const modal = $("rfidTestPanel");
        if (!modal) return;

        modal.classList.remove("hidden");
        modal.style.display = "flex";
    }

    function closeTestPanel() {
        const modal = $("rfidTestPanel");
        if (!modal) return;

        modal.classList.add("hidden");
        modal.style.display = "none";
    }

    function simulateTestScan() {
        const input = $("rfidTestUid");
        if (!input) return;

        const uid = input.value.trim();
        if (!uid) {
            showToast("Sila masukkan UID untuk ujian.", "warning");
            return;
        }

        RFID_STATE.testMode = true;
        handleUIDScanned(uid);
        RFID_STATE.testMode = false;
    }

    /* ==========================================================
       MANUAL ATTENDANCE
    ========================================================== */

    function populateManualModal() {
        const memberSelect = $("manualMember");
        const programSelect = $("manualProgram");

        if (memberSelect) {
            memberSelect.innerHTML = '<option value="">-- Pilih Ahli --</option>';
            RFID_STATE.members.forEach(function (m) {
                const opt = document.createElement("option");
                opt.value = m.id || m.ID || "";
                opt.textContent = (m.nama || m.Nama || "-") + (m.noRumah ? " — Rumah " + m.noRumah : "");
                memberSelect.appendChild(opt);
            });
        }

        if (programSelect) {
            programSelect.innerHTML = '<option value="">-- Pilih Program --</option>';
            RFID_STATE.programs.forEach(function (p) {
                const opt = document.createElement("option");
                opt.value = p.id || p.ID || "";
                opt.textContent = p.nama || p.namaProgram || p.Nama || "Program";
                programSelect.appendChild(opt);
            });
        }

        const dateInput = $("manualDate");
        if (dateInput && !dateInput.value) {
            const today = new Date();
            const y = today.getFullYear();
            const m = String(today.getMonth() + 1).padStart(2, "0");
            const d = String(today.getDate()).padStart(2, "0");
            dateInput.value = y + "-" + m + "-" + d;
        }
    }

    async function saveManualAttendance() {
        const memberId = ($("manualMember") || {}).value || "";
        const programId = ($("manualProgram") || {}).value || "";
        const date = ($("manualDate") || {}).value || "";

        if (!memberId) { showToast("Pilih ahli.", "warning"); return; }
        if (!programId) { showToast("Pilih program.", "warning"); return; }

        try {
            showLoading("Menyimpan kehadiran...");

            const response = await apiRequest(RFID_CONFIG.addAttendanceAction, {
                memberId: memberId,
                programId: programId,
                date: date
            });

            if (response && response.success) {
                showToast(response.message || "Kehadiran disimpan.", "success");

                const modal = $("manualAttendanceModal");
                if (modal) {
                    modal.classList.add("hidden");
                    modal.style.display = "none";
                }

                if (RFID_STATE.selectedProgramId) {
                    loadAttendanceForProgram(RFID_STATE.selectedProgramId);
                }
            } else {
                showToast((response && response.message) || "Gagal simpan kehadiran.", "error");
            }
        } catch (error) {
            console.error("[RFID] MANUAL SAVE ERROR:", error);
            showToast("Ralat: " + error.message, "error");
        } finally {
            hideLoading();
        }
    }

    /* ==========================================================
       EXPORT ATTENDANCE FUNCTIONS — DENGAN JAWATAN
    ========================================================== */

    function buildAttendanceList() {

        const attendance = Array.isArray(RFID_STATE.attendance)
            ? RFID_STATE.attendance
            : [];

        if (attendance.length === 0) {
            return null;
        }

        let programName = RFID_STATE.selectedProgramId || "Program";
        const program = RFID_STATE.programs.find(function (p) {
            return String(p.id || p.ID || "") === String(RFID_STATE.selectedProgramId);
        });

        if (program) {
            programName = program.nama || program.namaProgram || program.Nama || programName;
        }

        const list = attendance.map(function (row, i) {
            return {
                bil: i + 1,
                nama: row.nama || row.Nama || "-",
                noRumah: row.noRumah || row["No Rumah"] || row["No. Rumah"] || "-",
                jawatan: getMemberJawatan(row),   // ← GUNA FUNGSI BARU
                masa: row.masa || row.Masa || row.timestamp || "-",
                uidRfid: row.uidRfid || row["UID RFID"] || "-"
            };
        });

        return {
            programName: programName,
            list: list,
            total: list.length,
            tarikh: new Date().toISOString().split("T")[0]
        };
    }


    /* ==========================================================
       EXPORT CSV
    ========================================================== */

    function exportAttendanceCSV() {

    const data = buildAttendanceList();

    if (!data || !data.list || data.list.length === 0) {
        showToast("Tiada senarai hadir untuk diexport.", "warning");
        return;
    }

    let csv = "";

    csv += "SENARAI KEHADIRAN PROGRAM\n";
    csv += "Program: " + data.programName + "\n";
    csv += "Tarikh: " + data.tarikh + "\n";
    csv += "Jumlah Hadir: " + data.total + "\n";
    csv += "\n";
    csv += "Bil,Nama,No. Rumah,Jawatan,Masa,UID RFID\n";

    data.list.forEach(function (row) {
        csv += row.bil + "," +
               '"' + row.nama + '",' +
               '"' + row.noRumah + '",' +
               '"' + row.jawatan + '",' +
               '"' + row.masa + '",' +
               '"' + row.uidRfid + '"\n';
    });

    const filename = "Kehadiran_" +
                     data.programName.replace(/[^a-zA-Z0-9]/g, "_") +
                     "_" + data.tarikh + ".csv";

    downloadFile(csv, filename, "text/csv;charset=utf-8");

    showToast("CSV berjaya dimuat turun.", "success");
}


    /* ==========================================================
       EXPORT WHATSAPP — DENGAN JAWATAN
    ========================================================== */

    function exportAttendanceWhatsApp() {

    const data = buildAttendanceList();

    if (!data || !data.list || data.list.length === 0) {
        showToast("Tiada senarai hadir untuk dihantar.", "warning");
        return;
    }

    let message = "*SENARAI KEHADIRAN*\n";
    message += "📋 Program: " + data.programName + "\n";
    message += "📅 Tarikh: " + data.tarikh + "\n";
    message += "👥 Jumlah Hadir: " + data.total + "\n";
    message += "\n";

    data.list.forEach(function (row) {
        message += row.bil + ". " + row.nama;
        // JAWATAN sahaja (tanpa No. Rumah)
        if (row.jawatan && row.jawatan !== "-" && row.jawatan !== "Ahli") {
            message += " • " + row.jawatan;
        }
        message += " - " + row.masa + "\n";
    });

    message += "\n_DM3 Management System_";

    const url = "https://wa.me/?text=" + encodeURIComponent(message);

    window.open(url, "_blank");

    showToast("Membuka WhatsApp...", "info");
}


    /* ==========================================================
       EXPORT EMAIL — DENGAN JAWATAN
    ========================================================== */

    function exportAttendanceEmail() {

    const data = buildAttendanceList();

    if (!data || !data.list || data.list.length === 0) {
        showToast("Tiada senarai hadir untuk dihantar.", "warning");
        return;
    }

    const subject = "Senarai Kehadiran - " + data.programName +
                    " - " + data.tarikh;

    let body = "SENARAI KEHADIRAN PROGRAM\n\n";
    body += "Program: " + data.programName + "\n";
    body += "Tarikh: " + data.tarikh + "\n";
    body += "Jumlah Hadir: " + data.total + "\n";
    body += "\n";
    body += "----------------------------------------\n";

    data.list.forEach(function (row) {
        body += row.bil + ". " + row.nama;
        // JAWATAN sahaja (tanpa No. Rumah)
        if (row.jawatan && row.jawatan !== "-" && row.jawatan !== "Ahli") {
            body += " • " + row.jawatan;
        }
        body += " - " + row.masa + "\n";
    });

    body += "----------------------------------------\n";
    body += "\nDihantar oleh: DM3 Management System";

    const url = "mailto:?subject=" +
                encodeURIComponent(subject) +
                "&body=" + encodeURIComponent(body);

    window.location.href = url;

    showToast("Membuka Email...", "info");
}


    /* ==========================================================
       HELPER: Download File
    ========================================================== */

    function downloadFile(content, filename, mimeType) {

        const blob = new Blob([content], { type: mimeType });

        if (navigator.msSaveBlob) {
            navigator.msSaveBlob(blob, filename);
            return;
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = filename;
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();

        setTimeout(function () {
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /* ==========================================================
       BIND EVENTS
    ========================================================== */

    function bindEvents() {
        const connectBtn = $("connectRfidButton");
        if (connectBtn) connectBtn.onclick = connectSerialReader;

        const liveScanBtn = $("liveScanButton");
        if (liveScanBtn) liveScanBtn.onclick = openLiveScan;

        const closeLiveScanBtn = $("closeLiveScanButton");
        if (closeLiveScanBtn) closeLiveScanBtn.onclick = closeLiveScan;

        const fullscreenBtn = $("liveScanFullscreenBtn");
        if (fullscreenBtn) fullscreenBtn.onclick = toggleLiveScanFullscreen;

        const testBtn = $("rfidTestButton");
        if (testBtn) testBtn.onclick = openTestPanel;

        const simulateBtn = $("simulateRfidButton");
        if (simulateBtn) simulateBtn.onclick = simulateTestScan;

        const programSelect = $("rfidProgramSelect");
        if (programSelect) {
            programSelect.onchange = function () {
                RFID_STATE.selectedProgramId = programSelect.value;

                resetLiveScanUI();

                try {
                    localStorage.setItem(RFID_CONFIG.storageKeyProgram, programSelect.value);
                } catch (e) {}

                loadAttendanceForProgram(programSelect.value);
            };
        }

        const liveScanProgramSelect = $("liveScanProgramSelect");
        if (liveScanProgramSelect) {
            liveScanProgramSelect.onchange = function () {
                RFID_STATE.selectedProgramId = liveScanProgramSelect.value;

                resetLiveScanUI();

                if (programSelect) {
                    programSelect.value = liveScanProgramSelect.value;
                }

                try {
                    localStorage.setItem(RFID_CONFIG.storageKeyProgram, liveScanProgramSelect.value);
                } catch (e) {}

                loadAttendanceForProgram(liveScanProgramSelect.value);

                console.log(
                    "[RFID] Program Live Scan ditukar:",
                    liveScanProgramSelect.value
                );
            };
        }

        const manualBtn = $("manualAttendanceButton");
        if (manualBtn) {
            manualBtn.onclick = function () {
                populateManualModal();
                const modal = $("manualAttendanceModal");
                if (modal) {
                    modal.classList.remove("hidden");
                    modal.style.display = "flex";
                }
            };
        }

        const exportCsvBtn = $("exportCsvButton");
        if (exportCsvBtn) exportCsvBtn.onclick = exportAttendanceCSV;

        const exportWhatsappBtn = $("exportWhatsappButton");
        if (exportWhatsappBtn) exportWhatsappBtn.onclick = exportAttendanceWhatsApp;

        const exportEmailBtn = $("exportEmailButton");
        if (exportEmailBtn) exportEmailBtn.onclick = exportAttendanceEmail;

        document.addEventListener("click", function (event) {
            const closeEl = event.target.closest("[data-close-modal]");
            if (!closeEl) return;

            const modalId = closeEl.getAttribute("data-close-modal");
            if (!modalId) return;

            const modal = $(modalId);
            if (!modal) return;

            modal.classList.add("hidden");
            modal.style.display = "none";
        });

        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                const liveScanModal = $("liveScanScreen");
                if (liveScanModal && !liveScanModal.classList.contains("hidden")) {
                    closeLiveScan();
                }
            }
        });

        bindHIDScanner();
    }

    /* ==========================================================
       INIT
    ========================================================== */

    async function initRFID() {
        if (RFID_STATE.initialized) return;

        console.log("========================================");
        console.log("DM3 RFID.JS INITIALIZING");
        console.log("========================================");

        bindEvents();
        updateStatusBadge(false);

        await loadMembers();
        await loadPrograms();

        try {
            const lastProgram = localStorage.getItem(RFID_CONFIG.storageKeyProgram);
            if (lastProgram) {
                RFID_STATE.selectedProgramId = lastProgram;
                const select = $("rfidProgramSelect");
                if (select) select.value = lastProgram;
                console.log("[RFID] Restored program:", lastProgram);
            }
        } catch (e) {}

        RFID_STATE.initialized = true;

        console.log("DM3 RFID.JS READY");
    }

    /* ==========================================================
       PUBLIC API
    ========================================================== */

    window.DM3_RFID = {
        init: initRFID,
        connect: connectSerialReader,
        scan: handleUIDScanned,
        loadPrograms: loadPrograms,
        loadMembers: loadMembers,
        openLiveScan: openLiveScan,
        closeLiveScan: closeLiveScan,
        rebuildSidebar: rebuildScanSidebar,
        refreshAttendance: function () {
            if (RFID_STATE.selectedProgramId) {
                loadAttendanceForProgram(RFID_STATE.selectedProgramId);
            }
        }
    };

})(); // <-- TUTUP IIFE UTAMA


/* ==========================================================================
   DM3 LIVE SCAN CLOCK
========================================================================== */

(function () {

    "use strict";

    let dm3ScanClockInterval = null;

    const DM3_HARI = [
        'Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'
    ];

    const DM3_BULAN = [
        'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
        'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
    ];

    function pad2(num) {
        return String(num).padStart(2, '0');
    }

    function updateScanClock() {

        const bigTimeEl = document.getElementById('scanBigClockTime');
        const bigDateEl = document.getElementById('scanBigClockDate');

        if (!bigTimeEl || !bigDateEl) {
            return;
        }

        const now = new Date();

        const hh = pad2(now.getHours());
        const mm = pad2(now.getMinutes());
        const ss = pad2(now.getSeconds());

        bigTimeEl.textContent = hh + ':' + mm + ':' + ss;

        const hari = DM3_HARI[now.getDay()];
        const tarikh = now.getDate();
        const bulan = DM3_BULAN[now.getMonth()];
        const tahun = now.getFullYear();

        bigDateEl.textContent =
            hari + ', ' + tarikh + ' ' + bulan + ' ' + tahun;
    }

    function startScanClock() {

        if (dm3ScanClockInterval) {
            clearInterval(dm3ScanClockInterval);
        }

        updateScanClock();

        dm3ScanClockInterval = setInterval(updateScanClock, 1000);

        console.log('[DM3 SCAN CLOCK] Live clock started.');
    }

    function stopScanClock() {

        if (dm3ScanClockInterval) {
            clearInterval(dm3ScanClockInterval);
            dm3ScanClockInterval = null;
            console.log('[DM3 SCAN CLOCK] Live clock stopped.');
        }
    }

    window.DM3_SCAN_CLOCK = {
        start: startScanClock,
        stop: stopScanClock,
        update: updateScanClock,
        isRunning: function () {
            return dm3ScanClockInterval !== null;
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startScanClock);
    } else {
        startScanClock();
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            stopScanClock();
        } else {
            startScanClock();
        }
    });

})();


/* ==========================================================================
   BUNYI WELCOME
========================================================================== */

(function () {
    "use strict";

    let dm3WelcomeAudio = null;

    function playWelcomeSound() {

        try {

            if (!dm3WelcomeAudio) {

                dm3WelcomeAudio = new Audio("assets/sound/welcome.mp3");

                dm3WelcomeAudio.preload = "auto";
                dm3WelcomeAudio.volume = 0.7;

                console.log("[DM3 SOUND] welcome.mp3 loaded.");
            }

            dm3WelcomeAudio.currentTime = 0;

            const playPromise = dm3WelcomeAudio.play();

            if (playPromise !== undefined) {
                playPromise.catch(function (err) {
                    console.warn("[DM3 SOUND] Gagal main welcome.mp3:", err.message);
                });
            }

        } catch (error) {
            console.warn("[DM3 SOUND] Error:", error);
        }
    }

    window.playWelcomeSound = playWelcomeSound;

})();


/* ==========================================================================
   HALANG PAPAN KEKUNCI MAYA UNTUK RFID INPUT
========================================================================== */

(function () {
    "use strict";

    document.addEventListener("focusin", function (event) {
        const target = event.target;

        if (target && target.id === "rfid-hidden-input") {
            setTimeout(function () {
                try {
                    target.setAttribute("readonly", "readonly");

                    if (document.activeElement === target) {
                        target.setAttribute("inputmode", "none");
                    }
                } catch (e) {}
            }, 50);
        }
    });

    console.log("[DM3 RFID] Keyboard blocker ready.");

})();