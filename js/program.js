/* ============================================================================
   DM3 MANAGEMENT SYSTEM
   PROGRAM.JS V5.2 CLEAN
   Persatuan Penduduk Desa Mentari 3

   V5.2 CHANGES:
   - Tambah: Program Refresh Button (#program-refresh-btn)
   - Tambah: bindProgramRefreshButton()
   - Tambah: Clear cache sebelum refresh
   - Semua fungsi V5.1 dikekalkan
============================================================================ */

"use strict";

(function () {

/* ============================================================================
   1. CONFIG
============================================================================ */

const PROGRAM_VERSION = "V5.2";

const PROGRAM_CONFIG = {
    modalId: "program-modal",
    viewModalId: "program-view-modal",
    formId: "program-form",

    refreshButtonId: "program-refresh-btn",

    tableSelectors: [
        "#program-table", "#programs-table", "#programTable",
        "#programsTable", "table[data-program-table]",
        "#page-program table.data-table"
    ],

    tableBodySelectors: [
        "#program-table-body", "#programs-table-body",
        "#programTableBody", "#program-list-body",
        "tbody[data-program-body]"
    ],

    addButtonSelectors:
        "#add-program-btn, #program-add-btn, [data-add-program]",

    searchSelectors:
        "#program-search, #programSearch, [data-program-search]",

    filterSelectors:
        "#program-filter-status, #program-status-filter, " +
        "#programFilter, [data-program-filter]"
};

/* ============================================================================
   2. LOGGING
============================================================================ */

function programLog(...args)   { console.log("[PROGRAM V5.2]", ...args); }
function programWarn(...args)  { console.warn("[PROGRAM V5.2]", ...args); }
function programError(...args) { console.error("[PROGRAM V5.2]", ...args); }

/* ============================================================================
   3. DOM HELPERS
============================================================================ */

function programGet(id) { return id ? document.getElementById(id) : null; }

function programQuery(selectors) {
    if (!Array.isArray(selectors)) selectors = [selectors];
    for (const s of selectors) {
        try { const el = document.querySelector(s); if (el) return el; }
        catch (e) { /* ignore */ }
    }
    return null;
}

/* ============================================================================
   4. ESCAPE
============================================================================ */

function programEscapeHTML(value) {
    if (value === null || value === undefined) return "";
    return String(value)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* ============================================================================
   5. FIELD HELPER
============================================================================ */

function getProgramField(program, ...args) {
    if (!program || typeof program !== "object") return "";

    let names = [];
    let defaultValue = "";

    if (args.length && Array.isArray(args[0])) {
        names = args[0].slice();
        if (args.length > 1) defaultValue = args[1];
    } else {
        names = args.slice();
    }

    if (names.length && typeof names[names.length - 1] !== "string") {
        defaultValue = names.pop();
    }

    for (const name of names) {
        if (typeof name !== "string") continue;
        if (Object.prototype.hasOwnProperty.call(program, name)) {
            const value = program[name];
            if (value !== null && value !== undefined && String(value).trim() !== "") {
                return value;
            }
        }
    }
    return defaultValue;
}

/* ============================================================================
   6. NORMALIZE
============================================================================ */

function normalizeProgram(program) {
    if (!program || typeof program !== "object") return null;

    return {
        id: String(getProgramField(program, "id", "ID", "Id") || ""),
        nama: String(getProgramField(program,
            "namaProgram", "nama", "name", "programName",
            "nama_program", "tajukProgram", "tajuk", "Nama Program") || ""),
        tarikh: String(getProgramField(program, "tarikh", "date", "programDate", "Tarikh") || ""),
        masa: String(getProgramField(program, "masa", "time", "programTime", "Masa") || ""),
        lokasi: String(getProgramField(program, "lokasi", "tempat", "location", "place", "Lokasi", "Tempat") || ""),
        kategori: String(getProgramField(program, "kategori", "category", "jenis", "kategoriProgram", "Kategori") || ""),
        penerangan: String(getProgramField(program, "penerangan", "description", "keterangan", "Penerangan") || ""),
        status: String(getProgramField(program, "status", "Status") || "Akan Datang"),
        createdAt: String(getProgramField(program, "createdAt", "created_at") || ""),
        updatedAt: String(getProgramField(program, "updatedAt", "updated_at") || "")
    };
}

/* ============================================================================
   7. STATE
============================================================================ */

function getProgramStateArray() {
    let s;
    if (typeof DM3_STATE !== "undefined" && DM3_STATE) s = DM3_STATE;
    else if (window.DM3_STATE) s = window.DM3_STATE;
    else { window.DM3_STATE = {}; s = window.DM3_STATE; }

    if (!Array.isArray(s.programs)) s.programs = [];
    return s.programs;
}

function setProgramStateArray(programs) {
    const normalized = Array.isArray(programs)
        ? programs.map(normalizeProgram).filter(Boolean)
        : [];

    if (typeof DM3_STATE !== "undefined" && DM3_STATE) DM3_STATE.programs = normalized;
    if (window.DM3_STATE) window.DM3_STATE.programs = normalized;

    return normalized;
}

function getProgramState() { return getProgramStateArray(); }
function setProgramState(p) { return setProgramStateArray(p); }

/* ============================================================================
   8. FORMAT DATE / TIME / STATUS
============================================================================ */

function formatProgramTime(value) {
    if (value === null || value === undefined) return "-";
    const raw = String(value).trim();
    if (!raw) return "-";

    let m = raw.match(/(?:T|\s)(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (m) return String(m[1]).padStart(2, "0") + ":" + m[2];

    m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (m) return String(m[1]).padStart(2, "0") + ":" + m[2];

    return raw;
}

function formatProgramDate(value) {
    if (!value) return "-";
    try {
        let date;
        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const p = value.split("-");
            date = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
        } else {
            const norm = String(value).replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
            date = new Date(norm);
        }
        if (Number.isNaN(date.getTime())) return programEscapeHTML(value);
        return date.toLocaleDateString("ms-MY", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch (e) {
        return programEscapeHTML(value);
    }
}

function programToday() {
    const d = new Date();
    return d.getFullYear() + "-" +
        String(d.getMonth() + 1).padStart(2, "0") + "-" +
        String(d.getDate()).padStart(2, "0");
}

function normalizeProgramStatus(status) {
    const v = String(status || "").trim().toLowerCase();

    if (v === "berjalan" || v === "sedang berjalan" || v === "aktif" || v === "active") {
        return "Berjalan";
    }
    if (v === "selesai" || v === "completed" || v === "tamat") return "Selesai";
    if (v === "dibatalkan" || v === "cancelled" || v === "batal") return "Dibatalkan";
    if (v === "tidak aktif" || v === "inactive") return "Tidak Aktif";

    return "Akan Datang";
}

function programStatusBadge(status) {
    const n = normalizeProgramStatus(status);
    const l = n.toLowerCase();
    let c = "status-badge";
    if (l === "berjalan" || l === "aktif") c += " status-active";
    else if (l === "selesai") c += " status-completed";
    else if (l === "dibatalkan") c += " status-cancelled";
    else if (l === "tidak aktif") c += " status-inactive";
    else c += " status-upcoming";
    return `<span class="${c}">${programEscapeHTML(n)}</span>`;
}

/* ============================================================================
   9. MODAL
============================================================================ */

function ensureProgramModal() {
    let modal = document.getElementById(PROGRAM_CONFIG.modalId);
    if (modal) {
        ensureProgramForm(modal);
        bindProgramModalCloseEvents(modal);
        return modal;
    }

    programLog("Creating #program-modal...");

    modal = document.createElement("div");
    modal.id = PROGRAM_CONFIG.modalId;
    modal.className = "modal hidden";
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";

    modal.innerHTML = `
        <div class="modal-overlay" data-close-modal="program-modal"></div>
        <div class="modal-dialog" role="dialog" aria-modal="true">
            <div class="modal-header">
                <div>
                    <h3 id="program-modal-title" class="modal-title">Tambah Program</h3>
                    <p>Maklumat program persatuan.</p>
                </div>
                <button type="button" id="program-modal-close" class="modal-close"
                        data-close-modal="program-modal" aria-label="Tutup">&times;</button>
            </div>
            <form id="program-form" autocomplete="off">
                <input type="hidden" id="program-id" name="id">
                <div class="modal-body">
                    <div class="form-group">
                        <label for="program-name">Nama Program <span class="required">*</span></label>
                        <input type="text" id="program-name" name="nama" required>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="program-date">Tarikh <span class="required">*</span></label>
                            <input type="date" id="program-date" name="tarikh" required>
                        </div>
                        <div class="form-group">
                            <label for="program-time">Masa</label>
                            <input type="time" id="program-time" name="masa">
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="program-place">Tempat</label>
                            <input type="text" id="program-place" name="tempat">
                        </div>
                        <div class="form-group">
                            <label for="program-category">Kategori</label>
                            <input type="text" id="program-category" name="kategori">
                        </div>
                    </div>
                    <div class="form-group">
                        <label for="program-status">Status</label>
                        <select id="program-status" name="status">
                            <option value="Akan Datang">Akan Datang</option>
                            <option value="Berjalan">Berjalan</option>
                            <option value="Selesai">Selesai</option>
                            <option value="Dibatalkan">Dibatalkan</option>
                            <option value="Tidak Aktif">Tidak Aktif</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="program-description">Penerangan</label>
                        <textarea id="program-description" name="penerangan" rows="4"></textarea>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" id="program-cancel-btn" class="secondary-button"
                            data-close-modal="program-modal">
                        <i class="fa-solid fa-xmark"></i> Batal
                    </button>
                    <button type="submit" id="program-save-btn" class="primary-button">
                        <i class="fa-solid fa-floppy-disk"></i> Simpan Program
                    </button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    bindProgramModalCloseEvents(modal);
    programLog("Modal #program-modal created.");
    return modal;
}

function ensureProgramForm(modal) {
    if (!modal) return null;
    return modal.querySelector("#program-form") || null;
}

function programShowModal(modal) {
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.classList.add("active", "show");
    modal.style.display = "flex";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function programHideModal(modal) {
    if (!modal) return;
    modal.classList.remove("active", "show");
    modal.classList.add("hidden");
    modal.style.display = "none";
    modal.style.visibility = "hidden";
    modal.style.opacity = "0";
    modal.style.pointerEvents = "none";
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function closeProgramModal() {
    const modal = document.getElementById(PROGRAM_CONFIG.modalId);
    if (modal) programHideModal(modal);
}

function bindProgramModalCloseEvents(modal) {
    if (!modal) return;
    if (modal.dataset.programCloseBound === "true") return;
    modal.dataset.programCloseBound = "true";

    modal.querySelectorAll('[data-close-modal="program-modal"]').forEach(el => {
        el.addEventListener("click", e => {
            e.preventDefault();
            closeProgramModal();
        });
    });
}

/* ============================================================================
   10. FORM VALUES
============================================================================ */

function setFormValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = (value === null || value === undefined) ? "" : value;
}

function getFormValue(id) {
    const el = document.getElementById(id);
    return el ? String(el.value || "").trim() : "";
}

function readProgramForm() {
    return {
        id: getFormValue("program-id"),
        nama: getFormValue("program-name"),
        tarikh: getFormValue("program-date"),
        masa: getFormValue("program-time"),
        tempat: getFormValue("program-place"),
        kategori: getFormValue("program-category"),
        status: getFormValue("program-status"),
        penerangan: getFormValue("program-description")
    };
}

function validateProgramForm(data) {
    if (!data) return { valid: false, message: "Data tidak sah." };
    if (!String(data.nama || "").trim()) return { valid: false, message: "Sila masukkan Nama Program." };
    if (!String(data.tarikh || "").trim()) return { valid: false, message: "Sila pilih Tarikh." };
    return { valid: true, message: "" };
}

function openProgramModal(program = null) {

    programLog("openProgramModal:", program);

    const modal = ensureProgramModal();
    if (!modal) { programError("No modal."); return; }

    const form = ensureProgramForm(modal);
    if (!form) { programError("No form."); return; }

    try { form.reset(); } catch (e) { /* ignore */ }

    setFormValue("program-id", "");
    setFormValue("program-name", "");
    setFormValue("program-date", programToday());
    setFormValue("program-time", "");
    setFormValue("program-place", "");
    setFormValue("program-category", "");
    setFormValue("program-status", "Akan Datang");
    setFormValue("program-description", "");

    if (program) {
        const n = normalizeProgram(program);
        if (!n) { programError("Invalid program."); return; }

        let formattedDate = "";
        if (n.tarikh) {
            formattedDate = n.tarikh.split(' ')[0];
        }

        let formattedTime = "";
        if (n.masa) {
            let timePart = n.masa.includes(' ') ? n.masa.split(' ')[1] : n.masa;
            if (timePart) {
                formattedTime = timePart.substring(0, 5);
            }
        }

        setFormValue("program-id", n.id);
        setFormValue("program-name", n.nama);
        setFormValue("program-date", formattedDate);
        setFormValue("program-time", formattedTime);
        setFormValue("program-place", n.lokasi);
        setFormValue("program-category", n.kategori);
        setFormValue("program-status", normalizeProgramStatus(n.status));
        setFormValue("program-description", n.penerangan);
    }

    const title = modal.querySelector("#program-modal-title") ||
                  modal.querySelector(".modal-title") ||
                  modal.querySelector("h3");
    if (title) title.textContent = program ? "Edit Program" : "Tambah Program";

    const saveBtn = modal.querySelector("#program-save-btn");
    if (saveBtn) {
        saveBtn.innerHTML = program
            ? `<i class="fa-solid fa-floppy-disk"></i> Kemaskini Program`
            : `<i class="fa-solid fa-floppy-disk"></i> Simpan Program`;
    }

    bindProgramModalCloseEvents(modal);
    programShowModal(modal);
}

/* ============================================================================
   11. NOTIFY
============================================================================ */

function programNotify(message, type = "info") {
    const text = String(message || "");
    if (typeof window.showToast === "function") {
        try { window.showToast(text, type); return; } catch (e) { /* fallback */ }
    }
    if (type === "error") console.error("[PROGRAM]", text);
    else if (type === "warning") console.warn("[PROGRAM]", text);
    else console.log("[PROGRAM]", text);
}

/* ============================================================================
   12. API
============================================================================ */

async function programApiRequest(action, data = {}) {
    programLog("API REQUEST:", action, data);

    if (typeof window.apiRequest === "function") {
        const response = await window.apiRequest(action, data);
        programLog("API RESPONSE:", action, response);
        return response;
    }
    if (window.DM3_API && typeof window.DM3_API.request === "function") {
        return await window.DM3_API.request(action, data);
    }
    if (typeof window.dm3ApiRequest === "function") {
        return await window.dm3ApiRequest(action, data);
    }
    throw new Error("API DM3 tidak tersedia.");
}

function programResponseOK(r) {
    return r && typeof r === "object" && r.success === true;
}

/* ============================================================================
   13. CRUD
============================================================================ */

function programGenerateID() {
    return "PRG-" + Date.now().toString(36) + "-" +
        Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function getPrograms() {
    const response = await programApiRequest("getPrograms", {});
    if (!programResponseOK(response)) {
        throw new Error(response && response.message ? response.message : "Gagal ambil data program.");
    }
    const data = Array.isArray(response.data) ? response.data : [];
    programLog("GET PROGRAMS SUCCESS:", data.length, "rekod");
    return data;
}

async function refreshPrograms() {
    programLog("Refresh program...");
    try {
        const data = await getPrograms();
        setProgramStateArray(data);
        programLog("State updated:", getProgramStateArray());
        renderPrograms();
        programLog("Rendered:", getProgramStateArray().length);
        return true;
    } catch (error) {
        programError("refreshPrograms gagal:", error);
        if (getProgramStateArray().length === 0) renderPrograms();
        return false;
    }
}

function buildProgramPayload(formData) {
    const id = String(formData.id || "").trim();
    const nama = String(formData.nama || "").trim();
    const tarikh = String(formData.tarikh || "").trim();
    const masa = String(formData.masa || "").trim();
    const tempat = String(formData.tempat || "").trim();
    const kategori = String(formData.kategori || "").trim();
    const penerangan = String(formData.penerangan || "").trim();
    const status = String(formData.status || "Akan Datang").trim();

    return {
        id: id || programGenerateID(),
        namaProgram: nama,
        nama: nama,
        tarikh: tarikh,
        masa: masa,
        lokasi: tempat,
        tempat: tempat,
        kategori: kategori,
        penerangan: penerangan,
        status: status
    };
}

async function addProgram(formData) {
    programLog("ADD PROGRAM:", formData);
    const payload = buildProgramPayload(formData);
    if (!payload.namaProgram) throw new Error("Nama Program wajib diisi.");

    const response = await programApiRequest("addProgram", payload);
    if (!programResponseOK(response)) {
        throw new Error(response && response.message ? response.message : "Gagal tambah program.");
    }

    // Clear cache supaya data fresh
    if (typeof window.clearAPICache === "function") {
        window.clearAPICache();
    }

    await refreshPrograms();
    return response;
}

async function updateProgram(formData) {
    programLog("UPDATE PROGRAM:", formData);
    const payload = buildProgramPayload(formData);
    if (!payload.id) throw new Error("ID Program tidak dijumpai.");
    if (!payload.namaProgram) throw new Error("Nama Program wajib diisi.");

    const response = await programApiRequest("updateProgram", payload);
    if (!programResponseOK(response)) {
        throw new Error(response && response.message ? response.message : "Gagal kemaskini program.");
    }

    // Clear cache supaya data fresh
    if (typeof window.clearAPICache === "function") {
        window.clearAPICache();
    }

    await refreshPrograms();
    return response;
}

async function deleteProgram(id) {
    const pid = String(id || "").trim();
    if (!pid) throw new Error("ID Program tidak dijumpai.");

    const response = await programApiRequest("deleteProgram", { id: pid });
    if (!programResponseOK(response)) {
        throw new Error(response && response.message ? response.message : "Gagal padam program.");
    }

    // Clear cache supaya data fresh
    if (typeof window.clearAPICache === "function") {
        window.clearAPICache();
    }

    await refreshPrograms();
    return response;
}

function findProgramById(id) {
    const pid = String(id || "").trim();
    if (!pid) return null;
    return getProgramStateArray().find(p => String(p.id || "").trim() === pid) || null;
}

/* ============================================================================
   14. TABLE
============================================================================ */

function getProgramTableBody() { return programQuery(PROGRAM_CONFIG.tableBodySelectors); }
function getProgramTable() { return programQuery(PROGRAM_CONFIG.tableSelectors); }

function ensureProgramTableHeader() {
    const table = getProgramTable();
    if (!table) { programWarn("Jadual Program tidak ditemui."); return null; }

    let thead = table.querySelector("thead");
    if (!thead) {
        thead = document.createElement("thead");
        table.insertBefore(thead, table.firstChild);
    }
    let headRow = thead.querySelector("tr");
    if (!headRow) {
        headRow = document.createElement("tr");
        thead.appendChild(headRow);
    }
    headRow.innerHTML = `
        <th>Bil.</th>
        <th>Nama Program</th>
        <th>Tarikh</th>
        <th>Masa</th>
        <th>Tempat</th>
        <th>Kategori</th>
        <th>Penerangan</th>
        <th>Status</th>
        <th>Tindakan</th>
    `;
    return headRow;
}

function ensureProgramTableBody() {
    let tbody = getProgramTableBody();
    if (tbody) return tbody;
    const table = getProgramTable();
    if (!table) return null;
    tbody = document.createElement("tbody");
    tbody.id = "program-table-body";
    table.appendChild(tbody);
    return tbody;
}

/* ============================================================================
   15. FILTER
============================================================================ */

function getFilteredPrograms() {
    const programs = getProgramStateArray();

    const searchInput = programQuery(PROGRAM_CONFIG.searchSelectors);
    const filterInput = programQuery(PROGRAM_CONFIG.filterSelectors);

    const sv = searchInput ? String(searchInput.value || "").trim().toLowerCase() : "";
    const fv = filterInput ? String(filterInput.value || "").trim().toLowerCase() : "";

    return programs.filter(program => {
        const n = normalizeProgram(program);
        if (!n) return false;

        if (sv) {
            const s = [n.nama, n.lokasi, n.kategori, n.penerangan, n.status]
                .join(" ").toLowerCase();
            if (!s.includes(sv)) return false;
        }

        if (fv && fv !== "all" && fv !== "semua") {
            if (normalizeProgramStatus(n.status).toLowerCase() !== fv) return false;
        }
        return true;
    });
}

/* ============================================================================
   16. RENDER
============================================================================ */

function renderProgramEmptyState(tbody, message = "Tiada program.") {
    if (!tbody) return;
    tbody.innerHTML = `
        <tr class="program-empty-row">
            <td colspan="9" style="text-align:center;padding:40px 20px;">
                <div class="program-empty-state">
                    <div style="font-size:42px;margin-bottom:12px;opacity:.55;">
                        <i class="fa-solid fa-calendar-xmark"></i>
                    </div>
                    <div>${programEscapeHTML(message)}</div>
                </div>
            </td>
        </tr>
    `;
}

function renderProgramRow(program, index) {
    const n = normalizeProgram(program);
    if (!n) return "";

    const id = programEscapeHTML(n.id);
    const nama = programEscapeHTML(n.nama) || "-";
    const tarikh = formatProgramDate(n.tarikh);
    const masa = programEscapeHTML(formatProgramTime(n.masa)) || "-";
    const lokasi = programEscapeHTML(n.lokasi) || "-";
    const kategori = programEscapeHTML(n.kategori) || "-";
    const penerangan = programEscapeHTML(n.penerangan) || "-";
    const status = programStatusBadge(n.status);

    return `
        <tr class="program-row" data-program-id="${id}">
            <td>${index + 1}</td>
            <td><strong>${nama}</strong></td>
            <td>${tarikh}</td>
            <td>${masa}</td>
            <td>${lokasi}</td>
            <td>${kategori}</td>
            <td><span title="${penerangan}">${penerangan}</span></td>
            <td>${status}</td>
            <td>
                <div class="action-buttons"
                     style="display:flex;gap:6px;justify-content:center;">
                    <button type="button" class="icon-button"
                            title="Lihat" data-program-action="view"
                            data-program-id="${id}">
                        <i class="fa-solid fa-eye"></i>
                    </button>
                    <button type="button" class="icon-button"
                            title="Edit" data-program-action="edit"
                            data-program-id="${id}">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button type="button" class="icon-button danger"
                            title="Padam" data-program-action="delete"
                            data-program-id="${id}">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function renderPrograms() {
    programLog("Render programs...");

    const tbody = ensureProgramTableBody();
    if (!tbody) { programWarn("No tbody."); return false; }

    ensureProgramTableHeader();

    const programs = getProgramStateArray();
    const filtered = getFilteredPrograms();

    programLog("State:", programs.length, "Filtered:", filtered.length);

    if (filtered.length === 0) {
        renderProgramEmptyState(tbody,
            programs.length === 0
                ? "Tiada program direkodkan."
                : "Tiada program sepadan dengan carian.");
        updateProgramCount(0);
        return true;
    }

    tbody.innerHTML = filtered.map((p, i) => renderProgramRow(p, i)).join("");
    updateProgramCount(filtered.length);
    programLog("RENDER SUCCESS:", filtered.length, "daripada", programs.length);
    return true;
}

function updateProgramCount(count) {
    ["#program-count", "#programs-count", "#total-programs", "[data-program-count]"]
        .forEach(s => {
            try {
                const el = document.querySelector(s);
                if (el) el.textContent = String(count || 0);
            } catch (e) { /* ignore */ }
        });
}

/* ============================================================================
   17. VIEW / EDIT / DELETE
============================================================================ */

/* ============================================================================
   VIEW MODAL — FUTURISTIK
   ============================================================================ */

function ensureProgramViewModal() {

    let modal = document.getElementById(PROGRAM_CONFIG.viewModalId);

    if (modal) return modal;

    programLog("Mencipta modal view futuristik...");

    modal = document.createElement("div");
    modal.id = PROGRAM_CONFIG.viewModalId;
    modal.className = "program-view-modal";
    modal.style.display = "none";

    modal.innerHTML = `

        <div class="program-view-backdrop" data-program-close-view></div>

        <div class="program-view-dialog" role="dialog" aria-modal="true">

            <!-- HEADER -->
            <div class="program-view-header">
                <div class="program-view-icon">
                    <i class="fa-solid fa-calendar-check"></i>
                </div>

                <div class="program-view-title">
                    <h3>Maklumat Program</h3>
                    <p>Butiran lengkap program persatuan</p>
                </div>

                <button type="button" class="program-view-close" data-program-close-view aria-label="Tutup">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </div>

            <!-- BODY -->
            <div class="program-view-body">

                <!-- NAMA PROGRAM (HERO) -->
                <div class="program-view-hero">
                    <div class="program-view-hero-label">NAMA PROGRAM</div>
                    <div class="program-view-hero-name" id="program-view-nama">-</div>
                </div>

                <!-- GRID MAKLUMAT -->
                <div class="program-view-grid">

                    <div class="program-view-card">
                        <div class="program-view-card-icon" style="background: linear-gradient(135deg, #3b82f6, #2563eb);">
                            <i class="fa-solid fa-calendar-days"></i>
                        </div>
                        <div class="program-view-card-content">
                            <span class="program-view-card-label">Tarikh</span>
                            <strong class="program-view-card-value" id="program-view-tarikh">-</strong>
                        </div>
                    </div>

                    <div class="program-view-card">
                        <div class="program-view-card-icon" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);">
                            <i class="fa-solid fa-clock"></i>
                        </div>
                        <div class="program-view-card-content">
                            <span class="program-view-card-label">Masa</span>
                            <strong class="program-view-card-value" id="program-view-masa">-</strong>
                        </div>
                    </div>

                    <div class="program-view-card">
                        <div class="program-view-card-icon" style="background: linear-gradient(135deg, #10b981, #059669);">
                            <i class="fa-solid fa-location-dot"></i>
                        </div>
                        <div class="program-view-card-content">
                            <span class="program-view-card-label">Tempat</span>
                            <strong class="program-view-card-value" id="program-view-tempat">-</strong>
                        </div>
                    </div>

                    <div class="program-view-card">
                        <div class="program-view-card-icon" style="background: linear-gradient(135deg, #f59e0b, #d97706);">
                            <i class="fa-solid fa-tag"></i>
                        </div>
                        <div class="program-view-card-content">
                            <span class="program-view-card-label">Kategori</span>
                            <strong class="program-view-card-value" id="program-view-kategori">-</strong>
                        </div>
                    </div>

                </div>

                <!-- STATUS -->
                <div class="program-view-status-wrap">
                    <div class="program-view-status" id="program-view-status">
                        <i class="fa-solid fa-circle-info"></i>
                        <span>AKTIF</span>
                    </div>
                </div>

                <!-- PENERANGAN -->
                <div class="program-view-desc">
                    <div class="program-view-desc-header">
                        <i class="fa-solid fa-file-lines"></i>
                        <span>PENERANGAN</span>
                    </div>
                    <div class="program-view-desc-body" id="program-view-penerangan">-</div>
                </div>

            </div>

            <!-- FOOTER -->
            <div class="program-view-footer">
                <button type="button" class="program-view-btn program-view-btn-secondary" data-program-close-view>
                    <i class="fa-solid fa-xmark"></i>
                    Tutup
                </button>

                <button type="button" class="program-view-btn program-view-btn-primary" id="program-view-edit-btn">
                    <i class="fa-solid fa-pen"></i>
                    Edit
                </button>
            </div>

        </div>
    `;

    document.body.appendChild(modal);

    // Bind tutup
    modal.querySelectorAll("[data-program-close-view]").forEach(function (el) {
        el.addEventListener("click", function (e) {
            e.preventDefault();
            programHideViewModal(modal);
        });
    });

    // Bind edit
    const editBtn = modal.querySelector("#program-view-edit-btn");
    if (editBtn) {
        editBtn.addEventListener("click", function () {
            const id = modal.dataset.programId;
            if (!id) return;
            programHideViewModal(modal);
            setTimeout(function () {
                editProgram(id);
            }, 300);
        });
    }

    programLog("Modal view futuristik dicipta.");

    return modal;
}


/* ============================================================================
   SHOW / HIDE VIEW MODAL — BERSIH
   ============================================================================ */

function programShowViewModal(modal) {
    if (!modal) return;

    // Pastikan modal di dalam DOM
    if (!document.body.contains(modal)) {
        document.body.appendChild(modal);
    }

    // Set style penuh dari JavaScript (elak masalah CSS)
    modal.style.position = "fixed";
    modal.style.top = "0";
    modal.style.left = "0";
    modal.style.right = "0";
    modal.style.bottom = "0";
    modal.style.zIndex = "2147483647";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.padding = "20px";
    modal.style.background = "rgba(10, 20, 40, 0.75)";
    modal.style.backdropFilter = "blur(8px)";
    modal.style.opacity = "1";
    modal.style.pointerEvents = "auto";
    modal.style.visibility = "visible";

    modal.setAttribute("aria-hidden", "false");

    requestAnimationFrame(function () {
        modal.classList.add("show");
    });

    document.body.classList.add("modal-open");

    programLog("Modal view ditunjuk. zIndex:", modal.style.zIndex);
}


function programHideViewModal(modal) {
    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");

    setTimeout(function () {
        modal.style.display = "none";
        document.body.classList.remove("modal-open");
    }, 300);
}


function stopViewModalProtection() {
    if (PROGRAM_VIEW_MODAL_PROTECT) {
        clearInterval(PROGRAM_VIEW_MODAL_PROTECT);
        PROGRAM_VIEW_MODAL_PROTECT = null;
    }
}


function programHideViewModal(modal) {
    if (!modal) return;

    // Hentikan protect
    stopViewModalProtection();

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");

    setTimeout(function () {
        modal.style.display = "none";
        document.body.classList.remove("modal-open");
    }, 300);
}

function programHideViewModal(modal) {
    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");

    setTimeout(function () {
        modal.style.display = "none";
        document.body.classList.remove("modal-open");
    }, 300);
}


/* ============================================================================
   POPULATE VIEW MODAL
   ============================================================================ */

function populateProgramViewModal(program) {

    const modal = ensureProgramViewModal();
    if (!program || !modal) return modal;

    // ==========================================================
    // RESET STYLE — Elak masalah modal tak muncul
    // ==========================================================
    modal.style.display = "flex";
    modal.style.opacity = "1";
    modal.style.visibility = "visible";
    modal.style.pointerEvents = "auto";
    modal.classList.remove("hidden");
    // ==========================================================

    const n = normalizeProgram(program);
    if (!n) return modal;

    modal.dataset.programId = n.id;

    function setText(id, val) {
        const el = modal.querySelector("#" + id);
        if (el) el.textContent = val || "-";
    }

    setText("program-view-nama", n.nama);
    setText("program-view-tarikh", formatProgramDate(n.tarikh));
    setText("program-view-masa", formatProgramTime(n.masa));
    setText("program-view-tempat", n.lokasi);
    setText("program-view-kategori", n.kategori);
    setText("program-view-penerangan", n.penerangan);

    // Status badge dengan warna dinamik
    const statusEl = modal.querySelector("#program-view-status");
    if (statusEl) {

        const statusName = normalizeProgramStatus(n.status);
        const statusLower = statusName.toLowerCase();

        let color = "#3b82f6";
        let icon = "fa-circle-info";

        if (statusLower.indexOf("berjalan") !== -1) {
            color = "#10b981";
            icon = "fa-play";
        } else if (statusLower.indexOf("akan") !== -1) {
            color = "#f59e0b";
            icon = "fa-clock";
        } else if (statusLower.indexOf("selesai") !== -1) {
            color = "#6b7280";
            icon = "fa-check";
        } else if (statusLower.indexOf("batal") !== -1) {
            color = "#ef4444";
            icon = "fa-xmark";
        }

        statusEl.style.background = "linear-gradient(135deg, " + color + "22, " + color + "08)";
        statusEl.style.border = "1px solid " + color + "55";
        statusEl.style.color = color;
        statusEl.style.boxShadow = "0 0 25px " + color + "33";

        statusEl.innerHTML =
            '<i class="fa-solid ' + icon + '"></i>' +
            '<span>' + programEscapeHTML(statusName).toUpperCase() + '</span>';
    }

    return modal;
}


/* ============================================================================
   VIEW PROGRAM
   ============================================================================ */

function viewProgram(id) {
    programLog("viewProgram:", id);

    const program = findProgramById(id);

    if (!program) {
        programNotify("Program tidak dijumpai.", "error");
        return;
    }

    const modal = populateProgramViewModal(program);

    // Paksa tunjuk
    programShowViewModal(modal);
}


/* ============================================================================
   EDIT PROGRAM
   ============================================================================ */

function editProgram(id) {
    const program = findProgramById(id);
    if (!program) { programNotify("Rekod tidak dijumpai.", "error"); return; }

    const modal = ensureProgramModal();
    if (modal) {
        const form = modal.querySelector("#program-form");
        if (form) {
            form.querySelectorAll("input, select, textarea")
                .forEach(c => { c.disabled = false; });
            const sb = form.querySelector("#program-save-btn");
            if (sb) sb.style.display = "";
        }
    }
    openProgramModal(program);
}


/* ============================================================================
   DELETE PROGRAM
   ============================================================================ */

async function confirmDeleteProgram(id) {
    const program = findProgramById(id);
    if (!program) { programNotify("Rekod tidak dijumpai.", "error"); return; }

    const n = normalizeProgram(program);
    const nama = n && n.nama ? n.nama : "program ini";
    if (!window.confirm("Padam " + nama + "?")) return;

    try {
        await deleteProgram(id);
        programNotify("Program berjaya dipadam.", "success");
    } catch (error) {
        programError("Delete gagal:", error);
        programNotify(error.message || "Gagal padam program.", "error");
    }
}

/* ============================================================================
   18. FORM SUBMIT
============================================================================ */

async function handleProgramFormSubmit(event) {
    if (event) event.preventDefault();
    programLog("Form submitted.");

    const formData = readProgramForm();
    const validation = validateProgramForm(formData);

    if (!validation.valid) {
        programNotify(validation.message, "warning");
        return false;
    }

    const id = String(formData.id || "").trim();
    const saveBtn = document.getElementById("program-save-btn");

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.dataset.originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;
    }

    try {
        const response = id
            ? await updateProgram(formData)
            : await addProgram(formData);

        closeProgramModal();
        programNotify(
            response && response.message ? response.message : "Program disimpan.",
            "success"
        );
        return true;
    } catch (error) {
        programError("Submit gagal:", error);
        programNotify(error.message || "Gagal simpan program.", "error");
        return false;
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            if (saveBtn.dataset.originalText) {
                saveBtn.innerHTML = saveBtn.dataset.originalText;
            }
        }
    }
}

/* ============================================================================
   19. REFRESH BUTTON (BAHARU V5.2)
============================================================================ */

function bindProgramRefreshButton() {

    const refreshBtn = document.getElementById(PROGRAM_CONFIG.refreshButtonId);

    if (!refreshBtn) {
        programWarn("#program-refresh-btn tidak dijumpai.");
        return;
    }

    refreshBtn.onclick = async function (event) {

        event.preventDefault();

        programLog("Refresh button clicked.");

        // Tukar icon jadi spin
        const icon = refreshBtn.querySelector("i");
        if (icon) {
            icon.classList.add("fa-spin");
        }

        refreshBtn.disabled = true;

        try {

            // Clear cache frontend supaya data fresh
            if (typeof window.clearAPICache === "function") {
                window.clearAPICache();
                programLog("Cache cleared.");
            }

            // Refresh data program
            await refreshPrograms();

            // Papar toast
            programNotify("Data program dikemaskini.", "success");

        } catch (error) {

            programError("REFRESH ERROR:", error);
            programNotify(error.message || "Gagal refresh program.", "error");

        } finally {

            // Buang spin
            if (icon) {
                icon.classList.remove("fa-spin");
            }

            refreshBtn.disabled = false;
        }
    };

    programLog("Refresh button ready.");
}

/* ============================================================================
   20. EVENTS — DELEGATION
============================================================================ */

function bindProgramEvents() {

    /* --- ADD BUTTON --- */
    if (!window.__DM3_PROGRAM_ADD_BOUND__) {
        window.__DM3_PROGRAM_ADD_BOUND__ = true;
        document.addEventListener("click", function (event) {
            const btn = event.target.closest(PROGRAM_CONFIG.addButtonSelectors);
            if (!btn) return;
            event.preventDefault();
            programLog("Tambah Program clicked.");
            openProgramModal();
        });
        programLog("Add Button bound (delegation).");
    }

    /* --- TABLE ACTIONS --- */
    if (!window.__DM3_PROGRAM_TABLE_BOUND__) {
        window.__DM3_PROGRAM_TABLE_BOUND__ = true;
        document.addEventListener("click", function (event) {
            const btn = event.target.closest("[data-program-action]");
            if (!btn) return;
            const action = btn.getAttribute("data-program-action");
            const id = btn.getAttribute("data-program-id");
            if (!action || !id) return;
            event.preventDefault();
            programLog("Table action:", action, id);
            if (action === "view") viewProgram(id);
            else if (action === "edit") editProgram(id);
            else if (action === "delete") confirmDeleteProgram(id);
        });
        programLog("Table actions bound (delegation).");
    }

    /* --- SAVE / SUBMIT BUTTON --- */
    if (!window.__DM3_PROGRAM_SAVE_BOUND__) {
        window.__DM3_PROGRAM_SAVE_BOUND__ = true;

        document.addEventListener("click", function (event) {

            const btn = event.target.closest(
                "#program-modal button[type='submit'], " +
                "#program-modal .primary-button, " +
                "#program-save-btn"
            );

            if (!btn) return;

            if (!btn.closest("#program-form")) return;

            if (btn.hasAttribute("data-close-modal")) return;

            event.preventDefault();
            event.stopPropagation();

            programLog("Save button clicked (modal delegation).");
            handleProgramFormSubmit(event);
        });

        programLog("Save button bound (delegation).");
    }

    /* --- ESCAPE --- */
    if (!window.__DM3_PROGRAM_ESCAPE_BOUND__) {
        window.__DM3_PROGRAM_ESCAPE_BOUND__ = true;
        document.addEventListener("keydown", function (event) {
            if (event.key !== "Escape") return;
            const mm = document.getElementById(PROGRAM_CONFIG.modalId);
            if (mm && mm.classList.contains("show")) { closeProgramModal(); return; }
            const vm = document.getElementById(PROGRAM_CONFIG.viewModalId);
            if (vm && vm.classList.contains("show")) { programHideModal(vm); }
        });
    }

    programLog("All program events bound.");
}

/* ============================================================================
   21. INIT
============================================================================ */

let PROGRAM_MODULE_INITIALIZED = false;
let PROGRAM_MODULE_INITIALIZING = false;

async function initializeProgramModule(options = {}) {
    if (PROGRAM_MODULE_INITIALIZING) return false;
    PROGRAM_MODULE_INITIALIZING = true;

    try {
        programLog("==============================================");
        programLog("INITIALIZE PROGRAM MODULE");
        programLog("==============================================");

        try { ensureProgramModal(); }       catch (e) { programWarn("modal:", e); }
        try { ensureProgramTableHeader(); } catch (e) { programWarn("header:", e); }
        try { ensureProgramTableBody(); }   catch (e) { programWarn("body:", e); }
        try { bindProgramEvents(); }        catch (e) { programError("bind:", e); }
        try { bindProgramRefreshButton(); } catch (e) { programError("refresh btn:", e); }
        try { renderPrograms(); }           catch (e) { programWarn("render:", e); }

        PROGRAM_MODULE_INITIALIZED = true;
        programLog("PROGRAM MODULE READY (setup sahaja, no fetch)");
        return true;
    } catch (error) {
        programError("INIT GAGAL:", error);
        return false;
    } finally {
        PROGRAM_MODULE_INITIALIZING = false;
    }
}

async function initializeProgramModuleSafe(options = {}) {
    try {
        if (document.readyState === "loading") {
            await new Promise(r => {
                document.addEventListener("DOMContentLoaded", r, { once: true });
            });
        }
        return await initializeProgramModule(options);
    } catch (error) {
        programError("initializeProgramModuleSafe gagal:", error);
        return false;
    }
}

function forceRefreshPrograms() {
    programLog("Force refresh...");
    PROGRAM_MODULE_INITIALIZED = true;
    return refreshPrograms().then(r => {
        try { refreshProgramSummary(); } catch (e) { /* ignore */ }
        return r;
    });
}

function resetProgramModule() {
    PROGRAM_MODULE_INITIALIZED = false;
    try {
        if (window.DM3_STATE && Array.isArray(window.DM3_STATE.programs)) {
            window.DM3_STATE.programs = [];
        }
        renderPrograms();
    } catch (error) {
        programWarn("reset gagal:", error);
    }
}

/* ============================================================================
   22. SUMMARY / STATS
============================================================================ */

function getProgramStatistics(programs) {
    programs = Array.isArray(programs) ? programs : getProgramStateArray();
    const stats = {
        total: programs.length,
        akanDatang: 0, berjalan: 0, selesai: 0, dibatalkan: 0, tidakAktif: 0
    };
    programs.forEach(p => {
        const s = normalizeProgramStatus(p.status);
        if (s === "Akan Datang") stats.akanDatang++;
        else if (s === "Berjalan") stats.berjalan++;
        else if (s === "Selesai") stats.selesai++;
        else if (s === "Dibatalkan") stats.dibatalkan++;
        else if (s === "Tidak Aktif") stats.tidakAktif++;
    });
    return stats;
}

function updateProgramStatistics(programs) {
    const stats = getProgramStatistics(programs);
    function setFirst(sels, val) {
        for (const s of sels) {
            const el = document.querySelector(s);
            if (el) { el.textContent = String(val); return true; }
        }
        return false;
    }
    setFirst(["#program-total", "#total-program", "[data-program-total]"], stats.total);
    setFirst(["#program-upcoming", "#program-akan-datang", "[data-program-upcoming]"], stats.akanDatang);
    setFirst(["#program-completed", "#program-selesai", "[data-program-completed]"], stats.selesai);
    return stats;
}

function refreshProgramSummary() {
    const programs = getProgramStateArray();
    updateProgramStatistics(programs);
    return programs;
}

/* ============================================================================
   23. START
============================================================================ */

function startProgramModule() {

    programLog("START program module");

    try { ensureProgramModal(); }       catch (e) { programWarn(e); }
    try { ensureProgramTableHeader(); } catch (e) { programWarn(e); }
    try { ensureProgramTableBody(); }   catch (e) { programWarn(e); }
    try { bindProgramEvents(); }        catch (e) { programError(e); }
    try { bindProgramRefreshButton(); } catch (e) { programError(e); }
    try { renderPrograms(); }           catch (e) { programWarn(e); }

    PROGRAM_MODULE_INITIALIZED = true;

    programLog("PROGRAM MODULE READY (setup sahaja)");
}

/* Auto-start */
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startProgramModule, { once: true });
} else {
    startProgramModule();
}

/* ============================================================================
   24. EXPORTS
============================================================================ */

window.DM3_PROGRAM = window.DM3_PROGRAM || {};
Object.assign(window.DM3_PROGRAM, {
    VERSION: PROGRAM_VERSION,
    CONFIG: PROGRAM_CONFIG,
    getProgramState, setProgramState,
    getProgramStateArray, setProgramStateArray,
    ensureProgramModal, openProgramModal, closeProgramModal,
    programShowModal, programHideModal,
    ensureProgramViewModal, populateProgramViewModal,
    getPrograms, refreshPrograms,
    addProgram, updateProgram, deleteProgram,
    viewProgram, editProgram, confirmDeleteProgram, findProgramById,
    renderPrograms, renderProgramRow, refreshProgramSummary,
    getProgramStatistics, updateProgramStatistics,
    readProgramForm, validateProgramForm, handleProgramFormSubmit,
    normalizeProgram, normalizeProgramStatus, programStatusBadge,
    formatProgramDate, formatProgramTime, programToday,
    bindProgramEvents, bindProgramRefreshButton,
    initializeProgramModule, initializeProgramModuleSafe,
    forceRefreshPrograms, resetProgramModule
});

/* Alias global untuk compatibility */
window.getProgramState = getProgramState;
window.setProgramState = setProgramState;
window.refreshPrograms = refreshPrograms;
window.renderPrograms = renderPrograms;
window.openProgramModal = openProgramModal;
window.viewProgram = viewProgram;
window.editProgram = editProgram;
window.deleteProgram = deleteProgram;
window.loadPrograms = function () { return refreshPrograms(); };
window.initializeProgramModule = initializeProgramModule;
window.initializeProgramModuleSafe = initializeProgramModuleSafe;
window.forceRefreshPrograms = forceRefreshPrograms;
window.resetProgramModule = resetProgramModule;

programLog("DM3 PROGRAM.JS V5.2 CLEAN — LOADED");

})();