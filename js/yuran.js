/* ============================================================================
   DM3 PENGURUSAN YURAN — MATRIX VIEW
   yuran.js V2.0
============================================================================ */

(function () {
    "use strict";

    console.log("[DM3 YURAN] yuran.js V2.0 MATRIX loaded.");

       const YURAN_CONFIG = {
        apiAction: "getYuranMatrix",
        recordAction: "addYuran",
        deleteAction: "deleteYuran",
        pageSize: 50,

        // ===== AUTO-ROLLING 5 TAHUN =====
        // Tengah: Tahun semasa
        // Kiri: 2 tahun lepas
        // Kanan: 2 tahun depan
        offsetKiri: 2,
        offsetKanan: 2,
        tahunSemasa: new Date().getFullYear(),

        get tahunMula() {
            return this.tahunSemasa - this.offsetKiri;
        },
        get tahunAkhir() {
            return this.tahunSemasa + this.offsetKanan;
        }
    };

    const YURAN_STATE = {
        initialized: false,
        rawData: null,
        filteredData: [],
        tahunList: [],
        currentPage: 1,
        searchTerm: "",
        filterStatus: "semua",
        loading: false
    };


    /* ===== HELPERS ===== */

    function $id(id) { return document.getElementById(id); }

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatRM(v) {
        return "RM " + Number(v || 0).toFixed(2);
    }

    function log() {
        console.log.apply(console, ["[DM3 YURAN]"].concat(Array.prototype.slice.call(arguments)));
    }

    function showToast(msg, type) {
        if (typeof window.showToast === "function") {
            window.showToast(msg, type || "info");
        } else {
            log("TOAST:", type, msg);
        }
    }


    /* ===== API ===== */

    async function callAPI(action, data) {
        if (typeof window.dm3ApiRequest === "function") {
            return await window.dm3ApiRequest(action, data);
        }
        if (typeof window.apiRequest === "function") {
            return await window.apiRequest(action, data);
        }
        if (window.DM3_API && typeof window.DM3_API.request === "function") {
            return await window.DM3_API.request(action, data);
        }
        throw new Error("API DM3 tidak dijumpai.");
    }


    async function loadYuranMatrix() {
        try {
            log("Load matrix data...");
            YURAN_STATE.loading = true;

            const response = await callAPI(YURAN_CONFIG.apiAction, {
                tahunMula: YURAN_CONFIG.tahunMula,
                tahunAkhir: YURAN_CONFIG.tahunAkhir
            });

            log("API RESPONSE:", response);

            if (!response || response.success !== true) {
                throw new Error((response && response.message) || "Gagal load data.");
            }

            YURAN_STATE.rawData = response.data || {};
            YURAN_STATE.tahunList = response.data.tahunList || [];
            return YURAN_STATE.rawData;

        } catch (error) {
            console.error("[DM3 YURAN] LOAD ERROR:", error);
            showToast("Gagal load data: " + error.message, "error");
            YURAN_STATE.rawData = null;
            return null;
        } finally {
            YURAN_STATE.loading = false;
        }
    }


    async function recordPayment(ahliId, tahun) {
        const response = await callAPI(YURAN_CONFIG.recordAction, {
            ahliId: ahliId,
            tahun: String(tahun)
        });

        if (!response || response.success !== true) {
            throw new Error((response && response.message) || "Gagal rekod.");
        }

        return response;
    }


    async function deletePayment(rekodId) {
        const response = await callAPI(YURAN_CONFIG.deleteAction, {
            id: rekodId
        });

        if (!response || response.success !== true) {
            throw new Error((response && response.message) || "Gagal padam.");
        }

        return response;
    }


    /* ===== RENDER RINGKASAN (tahun semasa) ===== */

    function renderRingkasan() {
        const data = YURAN_STATE.rawData;
                const tahun = YURAN_SELECTED_YEAR || YURAN_CONFIG.tahunSemasa;

        let aktif = 0, tertunggak = 0, kutipan = 0;

        if (data && Array.isArray(data.senarai)) {
            data.senarai.forEach(function (row) {
                const r = row.rekodTahun && row.rekodTahun[tahun];
                if (r && r.status === "Aktif") {
                    aktif++;
                    kutipan += Number(r.jumlah || 0);
                } else {
                    tertunggak++;
                }
            });
        }

        const elAktif = $id("yuranCountAktif");
        const elTunggak = $id("yuranCountTunggak");
        const elKutipan = $id("yuranKutipan");

        if (elAktif) elAktif.textContent = String(aktif);
        if (elTunggak) elTunggak.textContent = String(tertunggak);
        if (elKutipan) elKutipan.textContent = formatRM(kutipan);
    }


    /* ===== FILTER & PAGINATION ===== */

    function applyFilter() {
        if (!YURAN_STATE.rawData || !Array.isArray(YURAN_STATE.rawData.senarai)) {
            YURAN_STATE.filteredData = [];
            return;
        }

        let list = YURAN_STATE.rawData.senarai.slice();
                const tahun = YURAN_SELECTED_YEAR || YURAN_CONFIG.tahunSemasa;

        // Filter
        if (YURAN_STATE.filterStatus === "sudah_bayar") {
            list = list.filter(function (row) {
                const r = row.rekodTahun && row.rekodTahun[tahun];
                return r && r.status === "Aktif";
            });
        } else if (YURAN_STATE.filterStatus === "belum_bayar") {
            list = list.filter(function (row) {
                const r = row.rekodTahun && row.rekodTahun[tahun];
                return !r || r.status !== "Aktif";
            });
        }

        // Search
        if (YURAN_STATE.searchTerm) {
            const term = YURAN_STATE.searchTerm.toLowerCase();
            list = list.filter(function (row) {
                const nama = String(row.nama || "").toLowerCase();
                const rumah = String(row.noRumah || "").toLowerCase();
                return nama.indexOf(term) !== -1 || rumah.indexOf(term) !== -1;
            });
        }

        YURAN_STATE.filteredData = list;
    }


    /* ===== RENDER JADUAL MATRIX ===== */

    function renderJadual() {
        const tbody = $id("yuranTableBody");
        if (!tbody) return;

        applyFilter();

        const list = YURAN_STATE.filteredData;
        const pageSize = YURAN_CONFIG.pageSize;
        const totalPages = Math.ceil(list.length / pageSize) || 1;
        const currentPage = Math.min(YURAN_STATE.currentPage, totalPages);
        YURAN_STATE.currentPage = currentPage;

        const startIdx = (currentPage - 1) * pageSize;
        const pageData = list.slice(startIdx, startIdx + pageSize);

        if (pageData.length === 0) {
            const colspan = 5 + YURAN_STATE.tahunList.length;
            tbody.innerHTML =
                '<tr><td colspan="' + colspan + '" class="empty-table">' +
                'Tiada rekod yuran untuk dipaparkan.' +
                '</td></tr>';
            renderPagination(0, 1);
            return;
        }

                const tahunSemasa = YURAN_SELECTED_YEAR || YURAN_CONFIG.tahunSemasa;
        let html = "";

        pageData.forEach(function (row, idx) {
            const bil = startIdx + idx + 1;
            const nama = escapeHtml(row.nama || "-");
            const rumah = escapeHtml(row.noRumah || "-");
            const ahliId = escapeHtml(row.ahliId || "");

            // Bina sel tahun
            let selTahun = "";

            YURAN_STATE.tahunList.forEach(function (tahun) {
                const rekod = row.rekodTahun && row.rekodTahun[tahun];
                const status = rekod ? rekod.status : "Tertunggak";
                const rekodId = rekod ? rekod.rekodId : "";
                const tarikhBayar = rekod ? rekod.tarikhBayar : "";

                let cls = "year-cell";
                let icon = "";
                let title = "";

                if (tahun > tahunSemasa) {
                    // Tahun akan datang — tak boleh bayar lagi
                    cls += " future";
                    icon = '<span class="year-icon"><i class="fa-solid fa-minus"></i></span>';
                    title = "Tahun akan datang";
                } else if (status === "Aktif") {
                    cls += " paid";
                    if (tahun === tahunSemasa) cls += " year-current-col";
                    icon = '<span class="year-icon"><i class="fa-solid fa-check"></i></span>';
                    title = "Dibayar pada " + tarikhBayar + " • Klik untuk padam";
                } else {
                    cls += " unpaid";
                    if (tahun === tahunSemasa) cls += " year-current-col";
                    icon = '<span class="year-icon"><i class="fa-solid fa-xmark"></i></span>';
                    title = "Belum bayar • Klik untuk tanda bayar";
                }

                selTahun +=
                    '<td class="' + cls + '"' +
                    ' data-ahli-id="' + ahliId + '"' +
                    ' data-tahun="' + tahun + '"' +
                    ' data-status="' + status + '"' +
                    ' data-rekod-id="' + escapeHtml(rekodId) + '"' +
                    ' title="' + escapeHtml(title) + '">' +
                    icon +
                    '</td>';
            });

            // Butang tindakan - tunjuk status tahun semasa
            const rekodSemasa = row.rekodTahun && row.rekodTahun[tahunSemasa];
            const isAktif = rekodSemasa && rekodSemasa.status === "Aktif";

            let tindakanBtn = "";
            if (isAktif) {
                tindakanBtn =
                    '<button type="button" class="yuran-view-btn" ' +
                    'data-action="view" data-ahli-id="' + ahliId + '">' +
                    '<i class="fa-solid fa-eye"></i> Lihat' +
                    '</button>';
            } else {
                tindakanBtn =
                    '<button type="button" class="yuran-bayar-btn" ' +
                    'data-action="bayar" data-ahli-id="' + ahliId + '" ' +
                    'data-tahun="' + tahunSemasa + '" data-nama="' + nama + '">' +
                    '<i class="fa-solid fa-check"></i> Bayar' +
                    '</button>';
            }

            html +=
                '<tr data-ahli-id="' + ahliId + '">' +
                    '<td>' + bil + '</td>' +
                    '<td>' + nama + '</td>' +
                    '<td>' + rumah + '</td>' +
                    selTahun +
                    '<td>' + tindakanBtn + '</td>' +
                '</tr>';
        });

        tbody.innerHTML = html;
        attachYearCellListeners();
        attachTindakanListeners();
        renderPagination(list.length, totalPages);
    }


    /* ===== EVENT: Klik sel tahun ===== */

    function attachYearCellListeners() {
        const tbody = $id("yuranTableBody");
        if (!tbody || tbody.dataset.yuranYearBound === "1") return;
        tbody.dataset.yuranYearBound = "1";

        tbody.addEventListener("click", async function (event) {
            const cell = event.target.closest(".year-cell");
            if (!cell) return;

            const status = cell.getAttribute("data-status");
            const tahun = Number(cell.getAttribute("data-tahun"));
            const ahliId = cell.getAttribute("data-ahli-id");
            const rekodId = cell.getAttribute("data-rekod-id");

            if (tahun > YURAN_CONFIG.tahunSemasa) {
                showToast("Tahun akan datang — belum boleh bayar.", "info");
                return;
            }

            if (status === "Aktif") {
                // Tanya padam
                const jawab = window.confirm(
                    "Padam rekod bayaran tahun " + tahun + "?\n\n" +
                    "Klik OK untuk padam."
                );
                if (!jawab) return;
                if (!rekodId) {
                    showToast("Rekod ID tidak dijumpai.", "warning");
                    return;
                }
                cell.classList.add("is-saving");
                try {
                    await deletePayment(rekodId);
                    showToast("Rekod bayaran dipadam.", "success");
                    await refreshAll();
                } catch (err) {
                    showToast("Gagal padam: " + err.message, "error");
                    cell.classList.remove("is-saving");
                }
            } else {
                // Tanda bayar
                const nama = cell.closest("tr").querySelector("td:nth-child(2)").textContent;
                const jawab = window.confirm(
                    "Tandakan " + nama + " telah bayar yuran " + tahun + "?\n\n" +
                    "Jumlah: RM" + Number(YURAN_STATE.rawData.jumlahYuran || 15).toFixed(2) + "\n" +
                    "Tarikh: hari ini\n" +
                    "Kaedah: Tunai"
                );
                if (!jawab) return;

                cell.classList.add("is-saving");
                try {
                    await recordPayment(ahliId, tahun);
                    showToast(nama + " — yuran " + tahun + " direkod.", "success");
                    await refreshAll();
                } catch (err) {
                    showToast("Gagal rekod: " + err.message, "error");
                    cell.classList.remove("is-saving");
                }
            }
        });
    }


    /* ===== EVENT: Butang Tindakan ===== */

    function attachTindakanListeners() {
        const tbody = $id("yuranTableBody");
        if (!tbody || tbody.dataset.yuranActionBound === "1") return;
        tbody.dataset.yuranActionBound = "1";

        tbody.addEventListener("click", async function (event) {
            const btn = event.target.closest("[data-action]");
            if (!btn) return;

            const action = btn.getAttribute("data-action");
            const ahliId = btn.getAttribute("data-ahli-id");
            const tahun = btn.getAttribute("data-tahun");
            const nama = btn.getAttribute("data-nama") || "";

            if (action === "bayar") {
                event.preventDefault();
                event.stopPropagation();

                const jawab = window.confirm(
                    "Tandakan " + nama + " telah bayar yuran " + tahun + "?\n\n" +
                    "Jumlah: RM" + Number(YURAN_STATE.rawData.jumlahYuran || 15).toFixed(2) + "\n" +
                    "Tarikh: hari ini\n" +
                    "Kaedah: Tunai"
                );
                if (!jawab) return;

                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    await recordPayment(ahliId, tahun);
                    showToast(nama + " — yuran direkod.", "success");
                    await refreshAll();
                } catch (err) {
                    showToast("Gagal rekod: " + err.message, "error");
                    btn.disabled = false;
                }
            } else if (action === "view") {
                event.preventDefault();
                event.stopPropagation();
                handleView(ahliId);
            }
        });
    }


    /* ===== PAGINATION ===== */

    function renderPagination(totalItems, totalPages) {
        const infoEl = $id("yuranPaginationInfo");
        const ctrlEl = $id("yuranPaginationControls");

        if (infoEl) {
            const start = totalItems === 0 ? 0 : ((YURAN_STATE.currentPage - 1) * YURAN_CONFIG.pageSize) + 1;
            const end = Math.min(YURAN_STATE.currentPage * YURAN_CONFIG.pageSize, totalItems);
            infoEl.textContent = "Papar " + start + " - " + end + " daripada " + totalItems;
        }

        if (!ctrlEl) return;
        ctrlEl.innerHTML = "";
        if (totalPages <= 1) return;

        // Prev
        const prev = document.createElement("button");
        prev.type = "button";
        prev.className = "yuran-pagination-btn";
        prev.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        prev.disabled = YURAN_STATE.currentPage === 1;
        prev.addEventListener("click", function () {
            if (YURAN_STATE.currentPage > 1) {
                YURAN_STATE.currentPage--;
                renderJadual();
            }
        });
        ctrlEl.appendChild(prev);

        // Pages
        let start = Math.max(1, YURAN_STATE.currentPage - 2);
        let end = Math.min(totalPages, start + 4);
        if (end - start < 4) start = Math.max(1, end - 4);

        for (let i = start; i <= end; i++) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "yuran-pagination-btn";
            btn.textContent = i;
            if (i === YURAN_STATE.currentPage) btn.classList.add("active");
            (function (n) {
                btn.addEventListener("click", function () {
                    YURAN_STATE.currentPage = n;
                    renderJadual();
                });
            })(i);
            ctrlEl.appendChild(btn);
        }

        // Next
        const next = document.createElement("button");
        next.type = "button";
        next.className = "yuran-pagination-btn";
        next.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        next.disabled = YURAN_STATE.currentPage === totalPages;
        next.addEventListener("click", function () {
            if (YURAN_STATE.currentPage < totalPages) {
                YURAN_STATE.currentPage++;
                renderJadual();
            }
        });
        ctrlEl.appendChild(next);
    }

        /* ===== JANA TAB TAHUN AUTO-ROLLING ===== */

    function generateTahunTabs() {
        const container = $id("yuranTahunTabs");
        if (!container) return;

        container.innerHTML = "";

        const tahunMula = YURAN_CONFIG.tahunMula;
        const tahunAkhir = YURAN_CONFIG.tahunAkhir;
        const tahunSemasa = YURAN_CONFIG.tahunSemasa;

        log("Jana tab tahun:", tahunMula, "→", tahunAkhir, "(tengah:", tahunSemasa + ")");

        for (let tahun = tahunMula; tahun <= tahunAkhir; tahun++) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "yuran-tahun-tab";
            btn.setAttribute("data-tahun", tahun);
            btn.textContent = tahun;

            // Tanda tahun semasa sebagai default active
            if (tahun === tahunSemasa) {
                btn.classList.add("active");
            }

            container.appendChild(btn);
        }

        // Bind event listeners
        bindTahunTabs();
    }

        /* ===== TAB TAHUN (FILTER) ===== */

    let YURAN_SELECTED_YEAR = new Date().getFullYear();

    function bindTahunTabs() {
        const tabs = document.querySelectorAll(".yuran-tahun-tab");
        if (!tabs || tabs.length === 0) return;

        tabs.forEach(function (tab) {
            tab.addEventListener("click", function () {
                const tahun = Number(tab.getAttribute("data-tahun"));
                if (!tahun) return;

                // Update active state
                tabs.forEach(function (t) { t.classList.remove("active"); });
                tab.classList.add("active");

                // Simpan pilihan
                YURAN_SELECTED_YEAR = tahun;

                log("Tab tahun ditukar:", tahun);

                // Refresh ringkasan + jadual
                renderRingkasan();
                renderJadual();
            });
        });

        log("Tab tahun bound:", tabs.length);
    }


    /* ===== SEARCH & FILTER ===== */

    function bindSearchFilter() {
        const search = $id("yuranSearch");
        const filter = $id("yuranFilter");

        if (search) {
            let timer = null;
            search.addEventListener("input", function () {
                if (timer) clearTimeout(timer);
                timer = setTimeout(function () {
                    YURAN_STATE.searchTerm = search.value.trim();
                    YURAN_STATE.currentPage = 1;
                    renderJadual();
                }, 250);
            });
        }

        if (filter) {
            filter.addEventListener("change", function () {
                YURAN_STATE.filterStatus = filter.value;
                YURAN_STATE.currentPage = 1;
                renderJadual();
            });
        }
    }


    /* ===== BUTANG REFRESH ===== */

    function bindRefresh() {
        const btn = $id("yuranRefreshBtn");
        if (!btn) return;

        btn.addEventListener("click", async function () {
            const icon = btn.querySelector("i");
            if (icon) icon.classList.add("fa-spin");
            btn.disabled = true;
            try {
                if (typeof window.clearAPICache === "function") window.clearAPICache();
                await refreshAll();
                showToast("Data yuran dikemaskini.", "success");
            } catch (e) {
                showToast("Gagal refresh.", "error");
            } finally {
                if (icon) icon.classList.remove("fa-spin");
                btn.disabled = false;
            }
        });
    }


    /* ===== BUTANG REMINDER ===== */

    function bindReminder() {
        const btn = $id("yuranReminderBtn");
        if (!btn) return;

        btn.addEventListener("click", function () {
            const tahun = YURAN_CONFIG.tahunSemasa;
            const tertunggak = (YURAN_STATE.rawData.senarai || []).filter(function (r) {
                const rr = r.rekodTahun && r.rekodTahun[tahun];
                return !rr || rr.status !== "Aktif";
            });

            if (tertunggak.length === 0) {
                showToast("Tiada ahli tertunggak.", "info");
                return;
            }

            const pilihan = window.prompt(
                "Hantar reminder kepada " + tertunggak.length + " ahli tertunggak " + tahun + ".\n\n" +
                "1 = WhatsApp\n" +
                "2 = Email\n\n" +
                "Masukkan nombor (1/2):",
                "1"
            );

            if (!pilihan) return;

            const jumlah = YURAN_STATE.rawData.jumlahYuran || 15;

            if (pilihan === "1") {
                // WhatsApp — hantar ke first only (WA limit)
                const names = tertunggak.slice(0, 5).map(function (r) { return r.nama; }).join(", ");
                const msg =
                    "*PERINGATAN YURAN " + tahun + "*\n\n" +
                    "Ahli tertunggak (" + tertunggak.length + "):\n" +
                    names + (tertunggak.length > 5 ? "\n...(" + (tertunggak.length - 5) + " lagi)" : "") + "\n\n" +
                    "Jumlah: RM " + Number(jumlah).toFixed(2) + " setiap ahli\n\n" +
                    "Sila jelaskan segera. Terima kasih.\n\n" +
                    "- Persatuan Penduduk Desa Mentari 3";
                window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
                showToast("WhatsApp dibuka.", "info");
            } else if (pilihan === "2") {
                const subject = "Peringatan Yuran " + tahun + " - DM3";
                let body = "Assalamualaikum,\n\n";
                body += "Peringatan yuran tahun " + tahun + " (RM " + Number(jumlah).toFixed(2) + ") masih belum dijelaskan.\n\n";
                body += "Senarai ahli tertunggak (" + tertunggak.length + "):\n\n";
                tertunggak.forEach(function (r, i) {
                    body += (i + 1) + ". " + r.nama + " (" + (r.noRumah || "-") + ")\n";
                });
                body += "\nSila jelaskan segera. Terima kasih.\n\n- DM3";
                window.location.href = "mailto:?subject=" +
                    encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
                showToast("Email dibuka.", "info");
            } else {
                showToast("Pilihan tidak sah.", "warning");
            }
        });
    }


    /* ===== BUTANG EXPORT ===== */

    function bindExport() {
        const btn = $id("yuranExportBtn");
        if (!btn) return;

        btn.addEventListener("click", function () {
            const pilihan = window.prompt(
                "Export senarai yuran:\n\n" +
                "1 = CSV (Excel)\n" +
                "2 = WhatsApp\n" +
                "3 = Email\n\n" +
                "Pilih (1/2/3):",
                "1"
            );

            if (!pilihan) return;

            const tahunSemasa = YURAN_CONFIG.tahunSemasa;
            const tahunList = YURAN_STATE.tahunList;
            const senarai = YURAN_STATE.rawData.senarai || [];

            if (pilihan === "1") {
                let csv = "SENARAI YURAN — DM3\n";
                csv += "Tarikh: " + new Date().toLocaleDateString("ms-MY") + "\n\n";
                csv += "Bil,Nama,No. Rumah";
                tahunList.forEach(function (t) { csv += "," + t; });
                csv += "\n";

                senarai.forEach(function (row, i) {
                    csv += (i + 1) + ',"' + (row.nama || "") + '","' + (row.noRumah || "") + '"';
                    tahunList.forEach(function (t) {
                        const r = row.rekodTahun && row.rekodTahun[t];
                        csv += "," + ((r && r.status === "Aktif") ? "YA" : "TIDAK");
                    });
                    csv += "\n";
                });

                const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "Yuran_DM3_" + Date.now() + ".csv";
                a.click();
                URL.revokeObjectURL(url);
                showToast("CSV dimuat turun.", "success");

            } else if (pilihan === "2") {
                let msg = "*SENARAI YURAN DM3*\n\n";
                msg += "Tahun Semasa: *" + tahunSemasa + "*\n\n";

                const aktif = senarai.filter(function (r) {
                    const rr = r.rekodTahun && r.rekodTahun[tahunSemasa];
                    return rr && rr.status === "Aktif";
                }).length;

                msg += "✅ Aktif: " + aktif + "\n";
                msg += "❌ Tertunggak: " + (senarai.length - aktif) + "\n\n";

                senarai.forEach(function (row, i) {
                    const r = row.rekodTahun && row.rekodTahun[tahunSemasa];
                    const icon = (r && r.status === "Aktif") ? "✅" : "❌";
                    msg += (i + 1) + ". " + icon + " " + row.nama + " (" + (row.noRumah || "-") + ")\n";
                });

                msg += "\n_DM3 Management System_";
                window.open("https://wa.me/?text=" + encodeURIComponent(msg), "_blank");
                showToast("WhatsApp dibuka.", "info");

            } else if (pilihan === "3") {
                const subject = "Senarai Yuran DM3 - " + tahunSemasa;
                let body = "SENARAI YURAN DM3\n";
                body += "Tahun: " + tahunSemasa + "\n\n";

                senarai.forEach(function (row, i) {
                    const r = row.rekodTahun && row.rekodTahun[tahunSemasa];
                    const st = (r && r.status === "Aktif") ? "AKTIF" : "TERTUNGGAK";
                    body += (i + 1) + ". [" + st + "] " + row.nama + " (" + (row.noRumah || "-") + ")\n";
                });

                window.location.href = "mailto:?subject=" +
                    encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
                showToast("Email dibuka.", "info");
            }
        });
    }


    /* ===== VIEW AHLI ===== */

    function handleView(ahliId) {
        const senarai = YURAN_STATE.rawData.senarai || [];
        const record = senarai.find(function (r) {
            return String(r.ahliId) === String(ahliId);
        });
        if (!record) { showToast("Rekod tidak dijumpai.", "warning"); return; }

        let msg = "MAKLUMAT YURAN\n\n";
        msg += "Nama: " + record.nama + "\n";
        msg += "Rumah: " + (record.noRumah || "-") + "\n";
        msg += "Jawatan: " + (record.jawatan || "Ahli") + "\n\n";
        msg += "Rekod Tahunan:\n";

        YURAN_STATE.tahunList.forEach(function (t) {
            const r = record.rekodTahun && record.rekodTahun[t];
            const status = r && r.status === "Aktif" ? "✅" : "❌";
            msg += status + " " + t + " — " +
                   (r && r.status === "Aktif" ? r.tarikhBayar + " (" + r.kaedah + ")" : "Belum bayar") +
                   "\n";
        });

        window.alert(msg);
    }


    /* ===== REFRESH ALL ===== */

    async function refreshAll() {
        const data = await loadYuranMatrix();

        // Update tajuk
        const title = $id("yuranSenaraiTitle");
        if (title) title.textContent = "Senarai Yuran (Matrix 2024 - 2028)";

        const sub = $id("yuranSenaraiSubtitle");
        if (sub) sub.textContent = "Klik pada sel tahun untuk tanda bayar atau padam.";

        renderRingkasan();
        renderJadual();
    }


    /* ===== INIT ===== */

           async function initYuran() {
        log("init() matrix view");

        // Jana tab tahun (auto-rolling — sentiasa 5 tahun)
        generateTahunTabs();

        if (!YURAN_STATE.initialized) {
            bindSearchFilter();
            bindRefresh();
            bindReminder();
            bindExport();
            YURAN_STATE.initialized = true;
            log("Listeners bound.");
        }

        await refreshAll();
        log("init() selesai.");
    }


    /* ===== EXPORT ===== */

    window.DM3_YURAN = {
        init: initYuran,
        refresh: refreshAll,
        state: YURAN_STATE,
        config: YURAN_CONFIG
    };

    log("yuran.js V2.0 MATRIX ready.");

})();