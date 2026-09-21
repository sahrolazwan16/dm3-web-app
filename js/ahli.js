/* ==========================================================================
   DM3 MANAGEMENT SYSTEM
   JS/AHLI.JS V4.7 FULL CLEAN
   --------------------------------------------------------------------------
   Persatuan Penduduk Desa Mentari 3

   FUNGSI:
   - Senarai Ahli
   - Nama / No. K/P / UID RFID / No. Rumah / Telefon / Jawatan / Status
   - Search Ahli
   - Refresh Ahli
   - Tambah Ahli
   - Edit Ahli
   - Padam Ahli
   - RFID UID
   - Status Bayaran
   - Tarikh Daftar
   - Catatan
   - Modal
   - Google Apps Script melalui api.js
   --------------------------------------------------------------------------
   SUSUNAN TABLE:
   Bil. | Nama | UID RFID | No. Rumah | Telefon | Jawatan | Status | Tindakan

   V4.7 PATCH:
   - Duplicate RFID check fixed
   - Tambah alias "Telepon" (dengan P)
   - Bandingkan ID secara fleksibel
   - Tambah medan No. K/P
   ========================================================================== */

(function () {

    "use strict";

    console.log("========================================");
    console.log("DM3 AHLI.JS V4.7 FULL CLEAN");
    console.log("========================================");


    /* ======================================================================
       1. CONFIGURATION
       ====================================================================== */

    const CONFIG = {
        tableBody: "membersTableBody",
        addButton: "add-member-btn",
        searchInput: "member-search",
        page: "page-ahli",
        modal: "dm3AhliModal",
        form: "dm3AhliForm",
        refreshButton: "dm3AhliRefreshButton"
    };


    /* ======================================================================
       2. STATE
       ====================================================================== */

    let editingId = null;
    let searchText = "";
    let initialized = false;
    let saving = false;


    /* ======================================================================
       3. DOM HELPER
       ====================================================================== */

    function byId(id) {
        return document.getElementById(id);
    }


    /* ======================================================================
       4. ESCAPE HTML
       ====================================================================== */

    function escapeHTML(value) {
        if (value === null || value === undefined) {
            return "";
        }

        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }


    /* ======================================================================
       5. NORMALIZE
       ====================================================================== */

    function normalize(value) {
        return String(
            value === null || value === undefined
                ? ""
                : value
        )
            .trim()
            .toLowerCase();
    }


    /* ======================================================================
       6. GET MEMBERS
       ====================================================================== */

    function getMembersArray() {
        if (
            typeof DM3_STATE !== "undefined" &&
            Array.isArray(DM3_STATE.members)
        ) {
            return DM3_STATE.members;
        }

        if (
            window.DM3_STATE &&
            Array.isArray(window.DM3_STATE.members)
        ) {
            return window.DM3_STATE.members;
        }

        return [];
    }


    /* ======================================================================
       7. GET ALL POSSIBLE IDs
       ====================================================================== */

    function getMemberIds(member) {
        if (!member) return [];

        return [
            member.id,
            member.ID,
            member.Id,
            member._row
        ]
            .map(function (v) {
                return v === null || v === undefined
                    ? ""
                    : String(v).trim();
            })
            .filter(Boolean);
    }


    /* ======================================================================
       8. GET RFID VALUE
       ====================================================================== */

    function getMemberRFID(member) {
        if (!member) return "";

        return (
            member.uidRfid ??
            member["UID RFID"] ??
            member.uid ??
            member.UID ??
            member.rfid ??
            member.RFID ??
            ""
        );
    }


    /* ======================================================================
       9. GET TELEFON VALUE
       ====================================================================== */

    function getMemberTelefon(member) {
        if (!member) return "";

        return (
            member.telepon ??
            member.Telepon ??
            member.Telefon ??
            member["No Telefon"] ??
            member["No Telepon"] ??
            member["No. Telefon"] ??
            member["No. Telepon"] ??
            member.phone ??
            member.noTelefon ??
            ""
        );
    }


    /* ======================================================================
       9b. GET NO. K/P VALUE
       ====================================================================== */

    function getMemberNoKp(member) {
        if (!member) return "";

        return (
            member.noKp ??
            member.NoKp ??
            member.NoKP ??
            member["No. K/P"] ??
            member["No K/P"] ??
            member["No KP"] ??
            member["No. KP"] ??
            member.KP ??
            member.IC ??
            ""
        );
    }


    /* ======================================================================
       10. TOAST
       ====================================================================== */

    function toast(message, type = "info") {
        if (typeof showToast === "function") {
            showToast(message, type);
            return;
        }

        console.log("[DM3 AHLI]", type, message);
    }


    /* ======================================================================
       11. LOADING
       ====================================================================== */

    function loadingShow(message) {
        if (typeof showLoading === "function") {
            showLoading(message);
        }
    }

    function loadingHide() {
        if (typeof hideLoading === "function") {
            hideLoading();
        }
    }


    /* ======================================================================
       12. API
       ====================================================================== */

    async function api(action, data = {}) {
        console.log("[DM3 AHLI] API REQUEST:", action, data);

        if (typeof window.apiRequest === "function") {
            return await window.apiRequest(action, data);
        }

        if (
            window.DM3_API &&
            typeof window.DM3_API.request === "function"
        ) {
            return await window.DM3_API.request(action, data);
        }

        if (
            window.dm3ApiRequest &&
            typeof window.dm3ApiRequest === "function"
        ) {
            return await window.dm3ApiRequest(action, data);
        }

        throw new Error("api.js belum dimuatkan.");
    }


    /* ======================================================================
       13. REFRESH MEMBERS
       ====================================================================== */

    async function refreshMembers(showMessage = true) {
        try {
            loadingShow("Memuatkan data ahli...");

            const response = await api("getMembers", {});

            console.log("[DM3 AHLI] GET MEMBERS RESPONSE:", response);

            if (!response || response.success !== true) {
                throw new Error(
                    response?.message || "Gagal mengambil data ahli."
                );
            }

            const members = Array.isArray(response.data)
                ? response.data
                : [];

            if (typeof DM3_STATE !== "undefined") {
                DM3_STATE.members = members;
            }

            if (window.DM3_STATE) {
                window.DM3_STATE.members = members;
            }

            render();

            if (showMessage) {
                toast("Data ahli berjaya dikemaskini.", "success");
            }

            return members;

        } catch (error) {
            console.error("[DM3 AHLI] REFRESH ERROR:", error);

            toast(
                error.message || "Gagal memuatkan data ahli.",
                "error"
            );

            return [];

        } finally {
            loadingHide();
        }
    }


    /* ======================================================================
       14. SEARCH
       ====================================================================== */

    function getFilteredMembers() {
        const members = getMembersArray();
        const search = normalize(searchText);

        if (!search) {
            return members;
        }

        return members.filter(function (member) {
            const text = [
                member.id,
                member.ID,
                member.uidRfid,
                member["UID RFID"],
                member.uid,
                member.rfid,
                member.nama,
                member.Nama,
                member.name,
                member.noKp,
                member.NoKp,
                member["No. K/P"],
                member["No K/P"],
                member.noRumah,
                member["No Rumah"],
                member["No. Rumah"],
                member.telefon,
                member.Telepon,
                member.Telefon,
                member.phone,
                member.noTelefon,
                member.email,
                member.status,
                member.Status,
                member.jawatan,
                member.Jawatan,
                member.statusBayaran
            ]
                .map(normalize)
                .join(" ");

            return text.includes(search);
        });
    }


    /* ======================================================================
       15. TABLE STYLE
       ====================================================================== */

    function ensureAhliTableStyle() {
        if (byId("dm3-ahli-v47-table-style")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "dm3-ahli-v47-table-style";

        style.textContent = `

            #membersTableBody td {
                vertical-align: middle;
            }

            #membersTableBody .dm3-ahli-name-cell {
                min-width: 190px;
                width: 22%;
                white-space: normal;
            }

            #membersTableBody .dm3-ahli-rfid-cell {
                min-width: 170px;
                width: 18%;
                white-space: nowrap;
                font-family:
                    ui-monospace,
                    SFMono-Regular,
                    Menlo,
                    Consolas,
                    monospace;
                font-size: 13px;
            }

            #membersTableBody td:nth-child(4) {
                min-width: 120px;
                width: 14%;
            }

            #membersTableBody td:nth-child(5) {
                min-width: 130px;
                width: 15%;
            }

            #membersTableBody td:nth-child(6) {
                min-width: 130px;
                width: 15%;
            }

            #membersTableBody td:last-child {
                min-width: 145px;
                white-space: nowrap;
            }

            #membersTableBody button {
                white-space: nowrap;
            }

        `;

        document.head.appendChild(style);
    }


    /* ======================================================================
       16. RENDER TABLE
       ====================================================================== */

    function render() {
        const tbody = byId(CONFIG.tableBody);

        if (!tbody) {
            console.warn("[DM3 AHLI] membersTableBody tidak dijumpai.");
            return;
        }

        const members = getFilteredMembers();

        tbody.innerHTML = "";

        if (members.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center;padding:30px;">
                        <div style="opacity:.7;">
                            <i class="fa-solid fa-users" style="font-size:28px;margin-bottom:10px;display:block;"></i>
                            ${
                                searchText
                                    ? "Tiada ahli yang sepadan dengan carian."
                                    : "Tiada rekod ahli."
                            }
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

                members.forEach(function (member, index) {

            const id = member.id ?? member.ID ?? member._row ?? "";
            const nama = member.nama ?? member.Nama ?? member.name ?? "-";
            const noKp = getMemberNoKp(member);
            const uidRfid = getMemberRFID(member);
            const noRumah =
                member.noRumah ??
                member["No Rumah"] ??
                member["No. Rumah"] ??
                member.no_rumah ??
                "-";
            const telefon = getMemberTelefon(member);
            const jawatan = member.jawatan ?? member.Jawatan ?? member.position ?? "";
            const status = member.status ?? member.Status ?? "Aktif";

            const statusClass =
                normalize(status) === "aktif"
                    ? "badge-success"
                    : "badge-warning";

            const row = document.createElement("tr");

            row.dataset.memberId = String(id);

            row.innerHTML = `
                <td>${index + 1}</td>

                <td class="dm3-ahli-name-cell">
                    <strong>${escapeHTML(nama)}</strong>
                </td>

                <td class="dm3-ahli-nokp-cell">
                    ${escapeHTML(noKp || "-")}
                </td>

                <td class="dm3-ahli-rfid-cell">
                    ${escapeHTML(uidRfid || "-")}
                </td>

                <td>${escapeHTML(noRumah || "-")}</td>

                <td>${escapeHTML(telefon || "-")}</td>

                <td>${escapeHTML(jawatan || "-")}</td>

                <td>
                    <span class="badge ${statusClass}">
                        ${escapeHTML(status)}
                    </span>
                </td>

                <td>
                    <div style="display:flex;gap:6px;justify-content:center;align-items:center;flex-wrap:wrap;">
                        <button
                            type="button"
                            class="btn btn-sm btn-primary"
                            data-dm3-ahli-edit="${escapeHTML(id)}"
                            title="Edit Ahli">
                            <i class="fa-solid fa-pen"></i>
                            Edit
                        </button>

                        <button
                            type="button"
                            class="btn btn-sm btn-danger"
                            data-dm3-ahli-delete="${escapeHTML(id)}"
                            title="Padam Ahli">
                            <i class="fa-solid fa-trash"></i>
                            Padam
                        </button>
                    </div>
                </td>
            `;

            tbody.appendChild(row);
        });
    }


    /* ======================================================================
       17. CREATE MODAL
       ====================================================================== */

    function createModal() {
        if (byId(CONFIG.modal)) {
            return;
        }

        const modal = document.createElement("div");

        modal.id = CONFIG.modal;
        modal.className = "dm3-ahli-modal";

        modal.innerHTML = `
            <div class="dm3-ahli-modal-backdrop" data-dm3-ahli-close></div>

            <div class="dm3-ahli-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="dm3AhliModalTitle">

                <div class="dm3-ahli-modal-header">
                    <div>
                        <h3 id="dm3AhliModalTitle">Tambah Ahli</h3>
                        <p id="dm3AhliModalSubtitle">Daftarkan ahli baru Persatuan Penduduk DM3.</p>
                    </div>

                    <button type="button" class="dm3-ahli-close" data-dm3-ahli-close aria-label="Tutup">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form id="${CONFIG.form}" autocomplete="off">

                    <input type="hidden" id="dm3AhliId" name="id">

                    <div class="dm3-ahli-form-grid">

                        <div class="dm3-ahli-form-group full">
                            <label for="dm3AhliNama">
                                Nama Ahli <span>*</span>
                            </label>
                            <input
                                type="text"
                                id="dm3AhliNama"
                                name="nama"
                                required
                                maxlength="150"
                                placeholder="Masukkan nama penuh">
                        </div>

                        <div class="dm3-ahli-form-group">
                            <label for="dm3AhliNoKp">No. K/P</label>
                            <input
                                type="text"
                                id="dm3AhliNoKp"
                                name="noKp"
                                maxlength="20"
                                placeholder="Contoh: 850101-14-5678">
                        </div>

                        <div class="dm3-ahli-form-group">
                            <label for="dm3AhliRumah">No. Rumah</label>
                            <input
                                type="text"
                                id="dm3AhliRumah"
                                name="noRumah"
                                maxlength="50"
                                placeholder="Contoh: 11-16-39">
                        </div>

                        <div class="dm3-ahli-form-group">
                            <label for="dm3AhliTelefon">Telefon</label>
                            <input
                                type="tel"
                                id="dm3AhliTelefon"
                                name="telepon"
                                maxlength="30"
                                placeholder="Contoh: 0123456789">
                        </div>

                        <div class="dm3-ahli-form-group">
                            <label for="dm3AhliEmail">Email</label>
                            <input
                                type="email"
                                id="dm3AhliEmail"
                                name="email"
                                maxlength="150"
                                placeholder="Email ahli">
                        </div>

                        <div class="dm3-ahli-form-group">
                            <label for="dm3AhliRFID">UID RFID</label>
                            <input
                                type="text"
                                id="dm3AhliRFID"
                                name="uidRfid"
                                maxlength="100"
                                placeholder="Contoh: 8724852">
                            <small>Boleh dibiarkan kosong jika belum ada kad RFID.</small>
                        </div>

                        <div class="dm3-ahli-form-group">
                            <label for="dm3AhliJawatan">Jawatan</label>
                            <select id="dm3AhliJawatan" name="jawatan">
                                <option value="Ahli">Ahli</option>
                                <option value="Pengerusi">Pengerusi</option>
                                <option value="Timbalan Pengerusi">Timbalan Pengerusi</option>
                                <option value="Naib Pengerusi">Naib Pengerusi</option>
                                <option value="Setiausaha">Setiausaha</option>
                                <option value="Naib Setiausaha">Naib Setiausaha</option>
                                <option value="Bendahari">Bendahari</option>
                                <option value="Naib Bendahari">Naib Bendahari</option>
                                <option value="AJK">AJK</option>
                                <option value="Juru Audit">Juru Audit</option>
                                <option value="Ketua Program">Ketua Program</option>
                            </select>
                        </div>

                        <div class="dm3-ahli-form-group">
                            <label for="dm3AhliStatus">Status</label>
                            <select id="dm3AhliStatus" name="status">
                                <option value="Aktif">Aktif</option>
                                <option value="Tidak Aktif">Tidak Aktif</option>
                            </select>
                        </div>

                        <div class="dm3-ahli-form-group">
                            <label for="dm3AhliBayaran">Status Bayaran</label>
                            <select id="dm3AhliBayaran" name="statusBayaran">
                                <option value="Belum Bayar">Belum Bayar</option>
                                <option value="Sudah Bayar">Sudah Bayar</option>
                            </select>
                        </div>

                        <div class="dm3-ahli-form-group">
                            <label for="dm3AhliTarikh">Tarikh Daftar</label>
                            <input
                                type="date"
                                id="dm3AhliTarikh"
                                name="tarikhDaftar">
                        </div>

                        <div class="dm3-ahli-form-group full">
                            <label for="dm3AhliCatatan">Catatan</label>
                            <textarea
                                id="dm3AhliCatatan"
                                name="catatan"
                                rows="3"
                                maxlength="500"
                                placeholder="Catatan tambahan..."></textarea>
                        </div>

                    </div>

                    <div class="dm3-ahli-modal-footer">
                        <button type="button" class="secondary-button" data-dm3-ahli-close>
                            Batal
                        </button>

                        <button type="submit" class="primary-button" id="dm3AhliSaveButton">
                            <i class="fa-solid fa-floppy-disk"></i>
                            Simpan Ahli
                        </button>
                    </div>

                </form>

            </div>
        `;

        document.body.appendChild(modal);

        injectModalCSS();
    }


    /* ======================================================================
       18. MODAL CSS
       ====================================================================== */

    function injectModalCSS() {
        if (byId("dm3AhliModalCSS")) {
            return;
        }

        const style = document.createElement("style");

        style.id = "dm3AhliModalCSS";

        style.textContent = `

            #${CONFIG.modal} {
                position:fixed;
                inset:0;
                z-index:99999;
                display:none;
                align-items:center;
                justify-content:center;
                padding:20px;
            }

            #${CONFIG.modal}.show {
                display:flex;
            }

            .dm3-ahli-modal-backdrop {
                position:absolute;
                inset:0;
                background:rgba(0,0,0,.65);
                backdrop-filter:blur(3px);
            }

            .dm3-ahli-modal-dialog {
                position:relative;
                z-index:2;
                width:min(760px,100%);
                max-height:90vh;
                overflow:auto;
                background:#fff;
                border-radius:16px;
                box-shadow:
                    0 20px 60px rgba(0,0,0,.30);
                animation:
                    dm3AhliModalIn .18s ease;
            }

            @keyframes dm3AhliModalIn {

                from {
                    opacity:0;
                    transform:
                        translateY(15px)
                        scale(.98);
                }

                to {
                    opacity:1;
                    transform:
                        translateY(0)
                        scale(1);
                }

            }

            .dm3-ahli-modal-header {
                display:flex;
                align-items:flex-start;
                justify-content:space-between;
                gap:20px;
                padding:20px 24px;
                border-bottom:
                    1px solid #e5e7eb;
            }

            .dm3-ahli-modal-header h3 {
                margin:0 0 5px;
                font-size:20px;
            }

            .dm3-ahli-modal-header p {
                margin:0;
                color:#6b7280;
                font-size:13px;
            }

            .dm3-ahli-close {
                width:38px;
                height:38px;
                border:0;
                border-radius:50%;
                background:#f3f4f6;
                cursor:pointer;
                font-size:18px;
                flex:none;
            }

            .dm3-ahli-close:hover {
                background:#e5e7eb;
            }

            #${CONFIG.form} {
                padding:24px;
            }

            .dm3-ahli-form-grid {
                display:grid;
                grid-template-columns:
                    repeat(2,minmax(0,1fr));
                gap:16px;
            }

            .dm3-ahli-form-group {
                display:flex;
                flex-direction:column;
                gap:7px;
            }

            .dm3-ahli-form-group.full {
                grid-column:1/-1;
            }

            .dm3-ahli-form-group label {
                font-size:13px;
                font-weight:600;
            }

            .dm3-ahli-form-group label span {
                color:#dc2626;
            }

            .dm3-ahli-form-group input,
            .dm3-ahli-form-group select,
            .dm3-ahli-form-group textarea {
                width:100%;
                box-sizing:border-box;
                padding:11px 12px;
                border:1px solid #d1d5db;
                border-radius:9px;
                outline:none;
                font:inherit;
                background:#fff;
            }

            .dm3-ahli-form-group input:focus,
            .dm3-ahli-form-group select:focus,
            .dm3-ahli-form-group textarea:focus {
                border-color:#2563eb;
                box-shadow:
                    0 0 0 3px
                    rgba(37,99,235,.10);
            }

            .dm3-ahli-form-group small {
                color:#6b7280;
                font-size:11px;
            }

            .dm3-ahli-modal-footer {
                display:flex;
                justify-content:flex-end;
                gap:10px;
                margin-top:24px;
                padding-top:18px;
                border-top:
                    1px solid #e5e7eb;
            }

            body.dm3-ahli-modal-open {
                overflow:hidden;
            }

            @media (max-width:640px) {

                #${CONFIG.modal} {
                    padding:10px;
                }

                .dm3-ahli-modal-dialog {
                    max-height:95vh;
                    border-radius:12px;
                }

                .dm3-ahli-form-grid {
                    grid-template-columns:1fr;
                }

                .dm3-ahli-form-group.full {
                    grid-column:auto;
                }

                #${CONFIG.form} {
                    padding:18px;
                }

                .dm3-ahli-modal-header {
                    padding:16px 18px;
                }

                .dm3-ahli-modal-footer {
                    flex-direction:column-reverse;
                }

                .dm3-ahli-modal-footer button {
                    width:100%;
                }

            }

        `;

        document.head.appendChild(style);
    }


    /* ======================================================================
       19. OPEN MODAL
       ====================================================================== */

    function openModal(member = null) {
        createModal();

        const modal = byId(CONFIG.modal);
        const form = byId(CONFIG.form);

        if (!modal || !form) {
            console.error("[DM3 AHLI] Modal gagal dibuka.");
            return;
        }

        form.reset();

        editingId = member
            ? String(
                member.ID ??
                member.id ??
                member._row ??
                ""
            ).trim()
            : null;

        byId("dm3AhliId").value = editingId || "";

        byId("dm3AhliNama").value = member
            ? (member.nama ?? member.Nama ?? member.name ?? "")
            : "";

        byId("dm3AhliNoKp").value = member
            ? getMemberNoKp(member)
            : "";

        byId("dm3AhliRumah").value = member
            ? (member.noRumah ?? member["No Rumah"] ?? member["No. Rumah"] ?? "")
            : "";

        byId("dm3AhliTelefon").value = member
            ? getMemberTelefon(member)
            : "";

        byId("dm3AhliEmail").value = member
            ? (member.email ?? "")
            : "";

        byId("dm3AhliRFID").value = member
            ? getMemberRFID(member)
            : "";

        byId("dm3AhliJawatan").value = member
            ? (member.jawatan ?? member.Jawatan ?? "Ahli")
            : "Ahli";

        byId("dm3AhliStatus").value = member
            ? (member.status ?? member.Status ?? "Aktif")
            : "Aktif";

        byId("dm3AhliBayaran").value = member
            ? (member.statusBayaran ?? member["Status Bayaran"] ?? "Belum Bayar")
            : "Belum Bayar";

        byId("dm3AhliTarikh").value = member
            ? (member.tarikhDaftar ?? member["Tarikh Daftar"] ?? "")
            : getToday();

        byId("dm3AhliCatatan").value = member
            ? (member.catatan ?? member.Catatan ?? "")
            : "";

        byId("dm3AhliModalTitle").textContent = member
            ? "Kemaskini Ahli"
            : "Tambah Ahli";

        byId("dm3AhliModalSubtitle").textContent = member
            ? "Kemaskini maklumat ahli Persatuan Penduduk DM3."
            : "Daftarkan ahli baru Persatuan Penduduk DM3.";

        modal.classList.add("show");
        document.body.classList.add("dm3-ahli-modal-open");

        setTimeout(function () {
            byId("dm3AhliNama")?.focus();
        }, 50);

        console.log("[DM3 AHLI] MODAL OPEN:", editingId);
    }


    /* ======================================================================
       20. CLOSE MODAL
       ====================================================================== */

    function closeModal() {
        const modal = byId(CONFIG.modal);

        if (!modal) {
            return;
        }

        modal.classList.remove("show");
        document.body.classList.remove("dm3-ahli-modal-open");

        editingId = null;

        console.log("[DM3 AHLI] MODAL CLOSED");
    }


    /* ======================================================================
       21. TODAY
       ====================================================================== */

    function getToday() {
        const date = new Date();

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return year + "-" + month + "-" + day;
    }


    /* ======================================================================
       22. GET FORM DATA
       ====================================================================== */

    function getFormData() {
        const id = byId("dm3AhliId").value.trim();
        const nama = byId("dm3AhliNama").value.trim();
        const noKp = byId("dm3AhliNoKp").value.trim();
        const noRumah = byId("dm3AhliRumah").value.trim();
        const telepon = byId("dm3AhliTelefon").value.trim();
        const email = byId("dm3AhliEmail").value.trim();
        const uidRfid = byId("dm3AhliRFID").value.trim().toUpperCase();
        const jawatan = byId("dm3AhliJawatan").value;
        const status = byId("dm3AhliStatus").value;
        const statusBayaran = byId("dm3AhliBayaran").value;
        const tarikhDaftar = byId("dm3AhliTarikh").value;
        const catatan = byId("dm3AhliCatatan").value.trim();

        return {
            id,
            uidRfid,
            nama,
            noKp,
            telepon,
            noRumah,
            jawatan,
            status,
            email,
            statusBayaran,
            tarikhDaftar,
            catatan
        };
    }


    /* ======================================================================
       23. VALIDATE
       ====================================================================== */

    function validate(data) {

        if (!data.nama) {
            toast("Nama ahli diperlukan.", "warning");
            byId("dm3AhliNama")?.focus();
            return false;
        }

        if (data.uidRfid) {

            const dataId = String(data.id || "").trim();
            const dataRfid = normalize(data.uidRfid);

            const duplicate = getMembersArray().find(function (member) {

                const memberIds = getMemberIds(member);
                const memberRfid = normalize(getMemberRFID(member));

                if (memberRfid !== dataRfid) {
                    return false;
                }

                if (dataId && memberIds.indexOf(dataId) !== -1) {
                    return false;
                }

                if (!dataId) {
                    return true;
                }

                return true;

            });

            if (duplicate) {
                toast(
                    "UID RFID tersebut sudah digunakan oleh " +
                    (duplicate.nama ?? duplicate.Nama ?? "ahli lain") +
                    ".",
                    "error"
                );

                byId("dm3AhliRFID")?.focus();
                return false;
            }
        }

        return true;
    }


    /* ======================================================================
       24. SAVE
       ====================================================================== */

    async function save() {

        if (saving) {
            return;
        }

        const data = getFormData();

        if (!validate(data)) {
            return;
        }

        saving = true;

        const button = byId("dm3AhliSaveButton");

        if (button) {
            button.disabled = true;
            button.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Menyimpan...
            `;
        }

        try {
            loadingShow(
                data.id
                    ? "Mengemaskini ahli..."
                    : "Menambah ahli..."
            );

            const action = data.id
                ? "updateMember"
                : "addMember";

            console.log("[DM3 AHLI] SAVE:", action, data);

            const response = await api(action, data);

            console.log("[DM3 AHLI] SAVE RESPONSE:", response);

            if (!response || response.success !== true) {
                throw new Error(
                    response?.message ||
                    (data.id
                        ? "Gagal mengemaskini ahli."
                        : "Gagal menambah ahli.")
                );
            }

            closeModal();

            await refreshMembers(false);

            if (typeof updateAllCounters === "function") {
                updateAllCounters();
            }

            if (typeof renderCurrentModule === "function") {
                try {
                    renderCurrentModule();
                } catch (error) {
                    console.warn(
                        "[DM3 AHLI] renderCurrentModule:",
                        error
                    );
                }
            }

            toast(
                response.message ||
                (data.id
                    ? "Ahli berjaya dikemaskini."
                    : "Ahli berjaya ditambah."),
                "success"
            );

        } catch (error) {
            console.error("[DM3 AHLI] SAVE ERROR:", error);

            toast(
                error.message || "Ralat semasa menyimpan ahli.",
                "error"
            );

        } finally {
            loadingHide();

            saving = false;

            if (button) {
                button.disabled = false;
                button.innerHTML = `
                    <i class="fa-solid fa-floppy-disk"></i>
                    Simpan Ahli
                `;
            }
        }
    }


    /* ======================================================================
       25. EDIT MEMBER
       ====================================================================== */

    function edit(id) {

        const targetId = String(id || "").trim();

        const member = getMembersArray().find(function (item) {

            const ids = getMemberIds(item);

            return ids.indexOf(targetId) !== -1;

        });

        if (!member) {
            toast("Rekod ahli tidak dijumpai.", "warning");
            return;
        }

        openModal(member);
    }


    /* ======================================================================
       26. DELETE MEMBER
       ====================================================================== */

    async function remove(id) {

        const targetId = String(id || "").trim();

        console.log("[DM3 AHLI] DELETE REQUEST ID:", targetId);

        const member = getMembersArray().find(function (item) {

            const ids = getMemberIds(item);

            return ids.indexOf(targetId) !== -1;

        });

        if (!member) {
            console.warn("[DM3 AHLI] DELETE MEMBER TIDAK DIJUMPAI:", targetId);
            toast("Rekod ahli tidak dijumpai.", "warning");
            return;
        }

        const realId =
            member.ID ??
            member.id ??
            member._row ??
            targetId;

        const nama =
            member.nama ??
            member.Nama ??
            "ahli ini";

        const confirmed = window.confirm(
            'Adakah anda pasti mahu memadam ahli "' +
            nama +
            '"?'
        );

        if (!confirmed) {
            return;
        }

        try {
            loadingShow("Memadam ahli...");

            const response = await api("deleteMember", {
                id: realId
            });

            console.log("[DM3 AHLI] DELETE RESPONSE:", response);

            if (!response || response.success !== true) {
                throw new Error(
                    response?.message || "Gagal memadam ahli."
                );
            }

            await refreshMembers(false);

            if (typeof updateAllCounters === "function") {
                updateAllCounters();
            }

            toast(
                response.message || "Ahli berjaya dipadam.",
                "success"
            );

        } catch (error) {
            console.error("[DM3 AHLI] DELETE ERROR:", error);

            toast(
                error.message || "Ralat semasa memadam ahli.",
                "error"
            );

        } finally {
            loadingHide();
        }
    }


    /* ======================================================================
       27. INITIALIZE
       ====================================================================== */

    function initialize() {

        if (initialized) {
            return;
        }

        console.log("========================================");
        console.log("DM3 AHLI.JS V4.7 INITIALIZING");
        console.log("========================================");

        ensureAhliTableStyle();
        createModal();

        /* --- ADD BUTTON --- */
        const addButton = byId(CONFIG.addButton);

        if (addButton) {
            addButton.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                openModal();
            });

            console.log("[DM3 AHLI] ADD BUTTON READY");
        }

        /* --- SEARCH INPUT --- */
        const searchInput = byId(CONFIG.searchInput);

        if (searchInput) {
            searchInput.addEventListener("input", function (event) {
                searchText = event.target.value;
                render();
            });

            console.log("[DM3 AHLI] SEARCH INPUT READY");
        }

        /* --- REFRESH BUTTON --- */
        const refreshButton = byId(CONFIG.refreshButton);

        if (refreshButton) {
            refreshButton.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();
                refreshMembers(true);
            });

            console.log("[DM3 AHLI] REFRESH BUTTON READY");
        }

        /* --- TABLE EVENT DELEGATION --- */
        document.addEventListener("click", function (event) {

            const editButton = event.target.closest("[data-dm3-ahli-edit]");

            if (editButton) {
                event.preventDefault();
                event.stopPropagation();

                const id = editButton.dataset.dm3AhliEdit;

                edit(id);

                return;
            }

            const deleteButton = event.target.closest("[data-dm3-ahli-delete]");

            if (deleteButton) {
                event.preventDefault();
                event.stopPropagation();

                const id = deleteButton.dataset.dm3AhliDelete;

                remove(id);

                return;
            }

            const closeButton = event.target.closest("[data-dm3-ahli-close]");

            if (closeButton) {
                event.preventDefault();
                event.stopPropagation();
                closeModal();
                return;
            }

        });

        /* --- FORM SUBMIT --- */
        const form = byId(CONFIG.form);

        if (form) {
            form.addEventListener("submit", function (event) {
                event.preventDefault();
                save();
            });

            console.log("[DM3 AHLI] FORM SUBMIT READY");
        }

        /* --- MODAL ESC KEY --- */
        document.addEventListener("keydown", function (event) {
            if (event.key === "Escape") {
                const modal = byId(CONFIG.modal);
                if (modal && modal.classList.contains("show")) {
                    closeModal();
                }
            }
        });

        initialized = true;

        console.log("[DM3 AHLI] INITIALIZED");
    }


    /* ======================================================================
       28. EXPORT
       ====================================================================== */

    window.DM3_AHLI = {
        init: initialize,
        refresh: refreshMembers,
        render: render,
        openModal: openModal,
        closeModal: closeModal,
        getMembers: getMembersArray
    };


    /* ======================================================================
       29. AUTO INITIALIZE
       ====================================================================== */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function () {
            setTimeout(initialize, 100);
        });
    } else {
        setTimeout(initialize, 100);
    }

})();