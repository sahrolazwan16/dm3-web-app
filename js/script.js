/* ==========================================================================
   DM3 MANAGEMENT SYSTEM
   SCRIPT.JS V4.3 CLEAN
   Persatuan Penduduk Desa Mentari 3

   V4.3 CHANGES:
   - sleep() helper ditambah
   - Jeda 800ms sebelum login (elak 404 Apps Script)
   - logout() clear cache API
   - Semua fungsi sebelumnya dikekalkan
========================================================================== */

"use strict";

(function () {

    /* ======================================================================
       1. APPLICATION CONFIGURATION
       ====================================================================== */

    window.DM3_CONFIG = {
        appName: "DM3 Management System",
        associationName: "Persatuan Penduduk Desa Mentari 3",
        shortName: "DM3",
        annualFee: 15,
        storageKey: "DM3_V4_STATE",
        userKey: "DM3_V4_USER",
        rememberKey: "DM3_V4_REMEMBER",
        version: "4.3-CLEAN"
    };


    /* ======================================================================
       2. GLOBAL STATE
       ====================================================================== */

    window.DM3_STATE = {
        loggedIn: false,
        currentUser: null,
        currentModule: "dashboard",
        members: [],
        ajk: [],
        portfolio: [],
        programs: [],
        attendance: [],
        settings: {},
        dashboard: {},
        selectedProgram: null,
        editingId: null,
        rfidConnected: false,
        rfidMode: false,
        search: "",
        initialized: false,
        loadingData: false,
        navigationInitialized: false,
        loginInitialized: false,
        globalButtonsInitialized: false,
        ahliInitialized: false
    };


    /* ======================================================================
       3. SLEEP HELPER
       ====================================================================== */

    function sleep(ms) {
        return new Promise(function (resolve) {
            setTimeout(resolve, ms);
        });
    }


    /* ======================================================================
       4. DOM HELPER
       ====================================================================== */

    function $(id) {
        return document.getElementById(id);
    }

    function $all(selector) {
        return document.querySelectorAll(selector);
    }

    function safeText(value) {
        if (value === null || value === undefined) {
            return "";
        }
        return String(value);
    }

    function escapeHTML(value) {
        return safeText(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function normalize(value) {
        return safeText(value).trim().toLowerCase();
    }


    /* ======================================================================
       5. TOAST SYSTEM
       ====================================================================== */

    window.showToast = function (message, type = "info") {

        console.log("[DM3 TOAST]", type, message);

        let container = $("dm3-toast-container");

        if (!container) {
            container = document.createElement("div");
            container.id = "dm3-toast-container";
            container.style.position = "fixed";
            container.style.top = "20px";
            container.style.right = "20px";
            container.style.zIndex = "999999";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.gap = "10px";
            container.style.maxWidth = "360px";
            document.body.appendChild(container);
        }

        const toast = document.createElement("div");

        const colors = {
            success: "#16a34a",
            error: "#dc2626",
            warning: "#d97706",
            info: "#2563eb"
        };

        toast.style.background = colors[type] || colors.info;
        toast.style.color = "#ffffff";
        toast.style.padding = "12px 16px";
        toast.style.borderRadius = "10px";
        toast.style.boxShadow = "0 8px 25px rgba(0,0,0,.20)";
        toast.style.fontSize = "14px";
        toast.style.fontWeight = "500";
        toast.style.cursor = "pointer";

        toast.textContent = safeText(message);

        toast.addEventListener("click", function () {
            toast.remove();
        });

        container.appendChild(toast);

        setTimeout(function () {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 4000);
    };


        /* ======================================================================
       6. LOADING SYSTEM dengan PROGRESS BAR
       ====================================================================== */

    window.showLoading = function (message = "Sedang memproses...") {

        console.log("[DM3 LOADING] SHOW:", message);

        const overlay = document.getElementById("loadingOverlay");
        const loadingText = document.getElementById("loadingText");

        if (overlay) {

            console.log("[DM3 LOADING] Existing #loadingOverlay FOUND");

            if (loadingText) {
                loadingText.textContent = message;
            }

            overlay.classList.remove("hidden");
            overlay.classList.add("active");

            overlay.style.display = "flex";
            overlay.style.visibility = "visible";
            overlay.style.opacity = "1";
            overlay.style.pointerEvents = "auto";

            return;
        }

        console.warn("[DM3 LOADING] #loadingOverlay tidak dijumpai.");

        let fallback = document.getElementById("dm3GlobalLoading");

        if (!fallback) {

            fallback = document.createElement("div");
            fallback.id = "dm3GlobalLoading";

            fallback.innerHTML = `
                <div class="dm3-loading-box">
                    <div class="dm3-loading-spinner"></div>
                    <div id="dm3LoadingMessage">Sedang memproses...</div>
                </div>
            `;

            fallback.style.cssText = `
                position:fixed;
                inset:0;
                z-index:999999;
                display:flex;
                align-items:center;
                justify-content:center;
                background:rgba(0,0,0,.45);
            `;

            document.body.appendChild(fallback);
        }

        const messageBox = document.getElementById("dm3LoadingMessage");

        if (messageBox) {
            messageBox.textContent = message;
        }

        fallback.style.display = "flex";
        fallback.style.visibility = "visible";
        fallback.style.opacity = "1";
        fallback.style.pointerEvents = "auto";
    };


    window.hideLoading = function () {

        console.log("[DM3 LOADING] HIDE");

        const overlay = document.getElementById("loadingOverlay");

        if (overlay) {

            console.log("[DM3 LOADING] Hiding #loadingOverlay");

            overlay.classList.remove("active");
            overlay.classList.add("hidden");

            overlay.style.display = "none";
            overlay.style.visibility = "hidden";
            overlay.style.opacity = "0";
            overlay.style.pointerEvents = "none";
        }

        const fallback = document.getElementById("dm3GlobalLoading");

        if (fallback) {
            fallback.classList.remove("show");
            fallback.style.display = "none";
            fallback.style.visibility = "hidden";
            fallback.style.opacity = "0";
            fallback.style.pointerEvents = "none";
        }

        console.log("[DM3 LOADING] ALL LOADING OVERLAYS HIDDEN");
    };


    /* ======================================================================
       LOADING PROGRESS — Tunjuk progres kepada pengguna
       ====================================================================== */

    window.showLoadingProgress = function (current, total, message) {

        const progressWrap = document.getElementById("loadingProgressWrap");
        const progressBar = document.getElementById("loadingProgressBar");
        const progressText = document.getElementById("loadingProgressText");
        const stepText = document.getElementById("loadingStepText");
        const loadingText = document.getElementById("loadingText");

        if (progressWrap) {
            progressWrap.style.display = "block";
        }

        const percent = total > 0 ? Math.round((current / total) * 100) : 0;

        if (progressBar) {
            progressBar.style.width = percent + "%";
        }

        if (progressText) {
            progressText.textContent = percent + "% (" + current + "/" + total + ")";
        }

        if (stepText && message) {
            stepText.textContent = message;
        }

        if (loadingText && message) {
            loadingText.textContent = message;
        }
    };


    window.hideLoadingProgress = function () {

        const progressWrap = document.getElementById("loadingProgressWrap");
        if (progressWrap) {
            progressWrap.style.display = "none";
        }
    };


    window.resetLoadingProgress = function () {

        const progressBar = document.getElementById("loadingProgressBar");
        const progressText = document.getElementById("loadingProgressText");
        const stepText = document.getElementById("loadingStepText");

        if (progressBar) progressBar.style.width = "0%";
        if (progressText) progressText.textContent = "0%";
        if (stepText) stepText.textContent = "";
    };


    /* ======================================================================
       7. DATE / FORMAT HELPERS
       ====================================================================== */

    window.dm3Today = function () {
        const date = new Date();
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    };


    window.dm3FormatDate = function (value) {

        if (!value) {
            return "-";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return safeText(value);
        }

        return date.toLocaleDateString("ms-MY", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        });
    };


    window.dm3FormatCurrency = function (value) {

        const number = Number(value);

        if (Number.isNaN(number)) {
            return "RM0.00";
        }

        return number.toLocaleString("ms-MY", {
            style: "currency",
            currency: "MYR"
        });
    };


    /* ======================================================================
       8. LOCAL STORAGE
       ====================================================================== */

    function saveLocalState() {

        try {

            const data = {
                members: DM3_STATE.members,
                ajk: DM3_STATE.ajk,
                portfolio: DM3_STATE.portfolio,
                programs: DM3_STATE.programs,
                attendance: DM3_STATE.attendance,
                settings: DM3_STATE.settings,
                dashboard: DM3_STATE.dashboard
            };

            localStorage.setItem(DM3_CONFIG.storageKey, JSON.stringify(data));

        } catch (error) {
            console.warn("[DM3 STORAGE] Save error:", error);
        }
    }


    function loadLocalState() {

        try {

            const raw = localStorage.getItem(DM3_CONFIG.storageKey);

            if (!raw) {
                return false;
            }

            const data = JSON.parse(raw);

            if (Array.isArray(data.members)) DM3_STATE.members = data.members;
            if (Array.isArray(data.ajk)) DM3_STATE.ajk = data.ajk;
            if (Array.isArray(data.portfolio)) DM3_STATE.portfolio = data.portfolio;
            if (Array.isArray(data.programs)) DM3_STATE.programs = data.programs;
            if (Array.isArray(data.attendance)) DM3_STATE.attendance = data.attendance;
            if (data.settings) DM3_STATE.settings = data.settings;
            if (data.dashboard) DM3_STATE.dashboard = data.dashboard;

            console.log("[DM3 STORAGE] Cache loaded.");

            return true;

        } catch (error) {
            console.warn("[DM3 STORAGE] Load error:", error);
            return false;
        }
    }


    /* ======================================================================
       9. CURRENT USER
       ====================================================================== */

    function saveCurrentUser(user, remember) {

        try {

            sessionStorage.setItem(DM3_CONFIG.userKey, JSON.stringify(user));

            if (remember) {
                localStorage.setItem(DM3_CONFIG.rememberKey, "1");
            } else {
                localStorage.removeItem(DM3_CONFIG.rememberKey);
            }

        } catch (error) {
            console.warn("[DM3 AUTH] Save user error:", error);
        }
    }


    function getStoredUser() {

        try {

            const raw = sessionStorage.getItem(DM3_CONFIG.userKey);

            if (!raw) {
                return null;
            }

            return JSON.parse(raw);

        } catch (error) {
            return null;
        }
    }


    function clearCurrentUser() {

        try {

            sessionStorage.removeItem(DM3_CONFIG.userKey);
            localStorage.removeItem(DM3_CONFIG.rememberKey);

        } catch (error) {
            console.warn("[DM3 AUTH] Clear user error:", error);
        }
    }


    /* ======================================================================
       10. API BRIDGE
       ====================================================================== */

    async function dm3Request(action, data = {}) {

        console.log("[DM3 SCRIPT V4.3] REQUEST:", action, data);

        let response;

        if (typeof window.apiRequest === "function") {
            response = await window.apiRequest(action, data);
        } else if (window.DM3_API && typeof window.DM3_API.request === "function") {
            response = await window.DM3_API.request(action, data);
        } else if (typeof window.dm3ApiRequest === "function") {
            response = await window.dm3ApiRequest(action, data);
        } else {
            throw new Error("api.js belum dimuatkan.");
        }

        console.log("[DM3 SCRIPT V4.3] RESPONSE:", action, response);

        return response;
    }


    window.apiRequest = window.apiRequest || dm3Request;

    window.DM3_API_BRIDGE = {
        request: dm3Request
    };


    /* ======================================================================
       11. LOGIN INPUT HELPERS
       ====================================================================== */

    function getLoginUsernameInput() {
        return $("login-username") || $("username") || $("loginUsername");
    }

    function getLoginPasswordInput() {
        return $("login-password") || $("password") || $("loginPassword");
    }

    function getRememberCheckbox() {
        return $("remember-me") || $("rememberMe") || $("remember");
    }


    /* ======================================================================
       12. LOGIN RESULT HANDLER
       ====================================================================== */

    async function processLogin(username, password, remember) {

        if (!username) {
            showToast("Sila masukkan username.", "warning");
            return false;
        }

        if (!password) {
            showToast("Sila masukkan password.", "warning");
            return false;
        }

        try {

            showLoading("Sedang memproses login...");

            // ==========================================================
            // PEMBETULAN: Jeda 800ms sebelum hantar login
            // Elak 404 Apps Script overload selepas logout
            // ==========================================================
            await sleep(800);
            // ==========================================================

            const response = await dm3Request("login", {
                username: username,
                password: password
            });

            console.log("DM3 LOGIN RESULT:", response);

            if (!response || response.success !== true) {
                throw new Error(
                    response?.message || "Username atau password salah."
                );
            }

            DM3_STATE.loggedIn = true;
            DM3_STATE.currentUser = response.data || null;

            saveCurrentUser(DM3_STATE.currentUser, remember);

            showToast(response.message || "Login berjaya.", "success");

            await showMainApplication();

            return true;

        } catch (error) {

            console.error("[DM3 LOGIN] ERROR:", error);

            DM3_STATE.loggedIn = false;

            showToast(error.message || "Login gagal.", "error");

            return false;

        } finally {

            hideLoading();

        }
    }


    /* ======================================================================
       13. LOGIN FORM INITIALIZATION
       ====================================================================== */

    function initializeLogin() {

        if (DM3_STATE.loginInitialized) {
            return;
        }

        const form = $("login-form") || $("loginForm");

        if (!form) {
            console.warn("[DM3 LOGIN] Login form tidak dijumpai.");
            return;
        }

        form.addEventListener("submit", async function (event) {

            event.preventDefault();

            const usernameInput = getLoginUsernameInput();
            const passwordInput = getLoginPasswordInput();
            const rememberInput = getRememberCheckbox();

            const username = usernameInput ? usernameInput.value.trim() : "";
            const password = passwordInput ? passwordInput.value : "";
            const remember = rememberInput ? Boolean(rememberInput.checked) : false;

            await processLogin(username, password, remember);
        });

        DM3_STATE.loginInitialized = true;

        console.log("[DM3 LOGIN] LOGIN HANDLER: READY");
    }


    /* ======================================================================
       14. PASSWORD TOGGLE
       ====================================================================== */

    function initializePasswordToggle() {

        const buttons = document.querySelectorAll(
            "[data-password-toggle], #toggle-password, #password-toggle, .password-toggle"
        );

        buttons.forEach(function (button) {

            if (button.dataset.dm3PasswordReady === "1") {
                return;
            }

            button.dataset.dm3PasswordReady = "1";

            button.addEventListener("click", function (event) {

                event.preventDefault();

                const passwordInput = getLoginPasswordInput();

                if (!passwordInput) {
                    return;
                }

                const isPassword = passwordInput.type === "password";

                passwordInput.type = isPassword ? "text" : "password";

                const icon = button.querySelector("i");

                if (icon) {
                    icon.classList.toggle("fa-eye", !isPassword);
                    icon.classList.toggle("fa-eye-slash", isPassword);
                }
            });
        });

        console.log("[DM3 LOGIN] PASSWORD TOGGLE: READY");
    }


    /* ======================================================================
       15. REMEMBERED LOGIN
       ====================================================================== */

    function checkRememberedLogin() {

        try {

            const remember = localStorage.getItem(DM3_CONFIG.rememberKey);

            if (remember !== "1") {
                return false;
            }

            const user = getStoredUser();

            if (!user) {
                return false;
            }

            DM3_STATE.loggedIn = true;
            DM3_STATE.currentUser = user;

            return true;

        } catch (error) {
            return false;
        }
    }


    /* ======================================================================
       16. SHOW / HIDE LOGIN & APPLICATION
       ====================================================================== */

    function setDisplay(element, display) {
        if (element) {
            element.style.display = display;
        }
    }


    function showLoginScreen() {

        console.log("[DM3 SCREEN] SWITCHING TO LOGIN SCREEN");

        const app = document.getElementById("app");

        if (app) {
            app.style.display = "none";
            app.style.visibility = "hidden";
            app.style.opacity = "0";
            app.style.pointerEvents = "none";
            app.classList.remove("active");
            app.classList.add("hidden");
        }

        const loginScreen = document.getElementById("loginScreen");

        if (loginScreen) {
            loginScreen.style.display = "";
            loginScreen.style.visibility = "visible";
            loginScreen.style.opacity = "1";
            loginScreen.style.pointerEvents = "auto";
            loginScreen.classList.remove("hidden");
            loginScreen.classList.add("active");
        }

        document.body.classList.remove("app-active");
        document.body.classList.add("login-active");

        const passwordInput = document.getElementById("password");

        if (passwordInput) {
            passwordInput.value = "";
        }

        console.log("[DM3 SCREEN] LOGIN SCREEN VISIBLE");
    }


    /* ======================================================================
       17. SHOW APPLICATION SCREEN
       ====================================================================== */

    function showApplicationScreen() {

        console.log("========================================");
        console.log("[DM3 SCREEN] SWITCHING TO MAIN APP");
        console.log("========================================");

        const loginScreen = document.getElementById("loginScreen");
        const app = document.getElementById("app");

        if (loginScreen) {
            loginScreen.style.display = "none";
            loginScreen.style.visibility = "hidden";
            loginScreen.style.opacity = "0";
            loginScreen.style.pointerEvents = "none";
            loginScreen.classList.remove("active");
            loginScreen.classList.add("hidden");
            console.log("[DM3 SCREEN] LOGIN DISEMBUNYIKAN");
        }

        if (app) {
            app.style.display = "block";
            app.style.visibility = "visible";
            app.style.opacity = "1";
            app.style.pointerEvents = "auto";
            app.classList.remove("hidden");
            app.classList.add("active");
            console.log("[DM3 SCREEN] #app BERJAYA DIBUKA");
        }

        document.body.classList.remove("login-active");
        document.body.classList.add("app-active");
    }


    /* ======================================================================
       18. LOGOUT
       ====================================================================== */

        function logout() {

        DM3_STATE.loggedIn = false;
        DM3_STATE.currentUser = null;

        // ==========================================================
        // CLEAR TOKEN
        // ==========================================================
        try {
            localStorage.removeItem("DM3_AUTH_USER");
            console.log("[DM3 LOGOUT] Token dibuang.");
        } catch (e) {}
        // ==========================================================

        clearCurrentUser();

        // Clear cache API supaya request selepas logout fresh
        if (typeof window.clearAPICache === "function") {
            try {
                window.clearAPICache();
                console.log("[DM3 LOGOUT] API cache cleared.");
            } catch (e) {
                console.warn("[DM3 LOGOUT] Gagal clear cache:", e);
            }
        }

        // Reset DM3_STATE data
        if (DM3_STATE) {
            DM3_STATE.members = [];
            DM3_STATE.ajk = [];
            DM3_STATE.portfolio = [];
            DM3_STATE.programs = [];
            DM3_STATE.attendance = [];
            DM3_STATE.settings = {};
            DM3_STATE.dashboard = {};
        }

        showLoginScreen();

        showToast("Anda telah log keluar.", "success");
    }


    window.dm3Logout = logout;


    /* ======================================================================
       19. LOAD MEMBERS
       ====================================================================== */

    async function loadMembers() {

        const response = await dm3Request("getMembers", {});

        if (!response || response.success !== true) {
            throw new Error(response?.message || "Gagal mengambil data ahli.");
        }

        DM3_STATE.members = Array.isArray(response.data) ? response.data : [];

        return DM3_STATE.members;
    }


    /* ======================================================================
       20. LOAD AJK
       ====================================================================== */

    async function loadAJK() {

        const response = await dm3Request("getAJK", {});

        if (!response || response.success !== true) {
            throw new Error(response?.message || "Gagal mengambil data AJK.");
        }

        DM3_STATE.ajk = Array.isArray(response.data) ? response.data : [];

        return DM3_STATE.ajk;
    }


    /* ======================================================================
       21. LOAD PORTFOLIO
       ====================================================================== */

    async function loadPortfolio() {

        const response = await dm3Request("getPortfolio", {});

        if (!response || response.success !== true) {
            throw new Error(response?.message || "Gagal mengambil data portfolio.");
        }

        DM3_STATE.portfolio = Array.isArray(response.data) ? response.data : [];

        return DM3_STATE.portfolio;
    }


    /* ======================================================================
       22. LOAD PROGRAMS
       ====================================================================== */

    async function loadPrograms() {

        const response = await dm3Request("getPrograms", {});

        if (!response || response.success !== true) {
            throw new Error(response?.message || "Gagal mengambil data program.");
        }

        DM3_STATE.programs = Array.isArray(response.data) ? response.data : [];

        return DM3_STATE.programs;
    }


    /* ======================================================================
       23. LOAD ATTENDANCE
       ====================================================================== */

    async function loadAttendance() {

        const response = await dm3Request("getAttendance", {});

        if (!response || response.success !== true) {
            throw new Error(response?.message || "Gagal mengambil data kehadiran.");
        }

        DM3_STATE.attendance = Array.isArray(response.data) ? response.data : [];

        return DM3_STATE.attendance;
    }


    /* ======================================================================
       24. LOAD SETTINGS
       ====================================================================== */

    async function loadSettings() {

        const response = await dm3Request("getSettings", {});

        if (!response || response.success !== true) {
            throw new Error(response?.message || "Gagal mengambil settings.");
        }

        DM3_STATE.settings = response.data || {};

        return DM3_STATE.settings;
    }


    /* ======================================================================
       25. LOAD DASHBOARD
       ====================================================================== */

    async function loadDashboard() {

        const response = await dm3Request("getDashboard", {});

        if (!response || response.success !== true) {
            throw new Error(response?.message || "Gagal mengambil dashboard.");
        }

        DM3_STATE.dashboard = response.data || {};

        return DM3_STATE.dashboard;
    }


       /* ======================================================================
       26. LOAD APPLICATION DATA dengan PROGRESS BAR
       ====================================================================== */

    async function loadApplicationData() {

        if (DM3_STATE.loadingData) {
            console.warn("[DM3 DATA] Loading sudah berjalan.");
            return;
        }

        DM3_STATE.loadingData = true;

        try {

            // Reset progress
            window.resetLoadingProgress();
            showLoading("Memuatkan data DM3...");

            loadLocalState();

            // ==========================================================
            // MUAT DATA DENGAN PROGRESS BAR
            // ==========================================================
            const totalSteps = 6;
            let currentStep = 0;

            // Step 1: Members
            currentStep++;
            window.showLoadingProgress(currentStep, totalSteps, "Memuatkan data ahli...");
            await loadMembers();
            await sleep(1500);

            // Step 2: AJK
            currentStep++;
            window.showLoadingProgress(currentStep, totalSteps, "Memuatkan data AJK...");
            await loadAJK();
            await sleep(1500);

            // Step 3: Portfolio
            currentStep++;
            window.showLoadingProgress(currentStep, totalSteps, "Memuatkan data portfolio...");
            await loadPortfolio();
            await sleep(1500);

            // Step 4: Settings
            currentStep++;
            window.showLoadingProgress(currentStep, totalSteps, "Memuatkan tetapan sistem...");
            await loadSettings();
            await sleep(1500);

            // Step 5: Attendance
            currentStep++;
            window.showLoadingProgress(currentStep, totalSteps, "Memuatkan data kehadiran...");
            await loadAttendance();
            await sleep(1500);

            // Step 6: Dashboard
            currentStep++;
            window.showLoadingProgress(currentStep, totalSteps, "Menyediakan dashboard...");
            await loadDashboard();

            // ==========================================================

            DM3_STATE.initialized = true;

            saveLocalState();

            updateAllCounters();

            // AHLI.JS adalah renderer utama untuk modul AHLI.
            if (window.DM3_AHLI && typeof window.DM3_AHLI.render === "function") {
                console.log("[DM3] AHLI.JS RENDERER INITIAL");
                window.DM3_AHLI.render();
            }

            renderDashboard();

            navigateTo("dashboard");

            // Selesai — tunjuk 100%
            window.showLoadingProgress(totalSteps, totalSteps, "Selesai!");
            await sleep(400);

        } catch (error) {

            console.error("[DM3 DATA] LOAD ERROR:", error);

            showToast(error.message || "Gagal memuatkan data DM3.", "error");

        } finally {

            DM3_STATE.loadingData = false;

            window.hideLoadingProgress();
            hideLoading();
        }
    }


    /* ======================================================================
       27. SHOW MAIN APPLICATION
       ====================================================================== */

    async function showMainApplication() {

        console.log("========================================");
        console.log("[DM3 APP] SHOW MAIN APPLICATION");
        console.log("========================================");

        if (typeof showApplicationScreen === "function") {
            try {
                showApplicationScreen();
            } catch (error) {
                console.error("[DM3 APP] showApplicationScreen ERROR:", error);
            }
        }

        const loginScreen = document.getElementById("loginScreen");

        if (loginScreen) {
            loginScreen.style.display = "none";
            loginScreen.style.visibility = "hidden";
            loginScreen.style.opacity = "0";
            loginScreen.style.pointerEvents = "none";
            loginScreen.classList.remove("active");
            loginScreen.classList.add("hidden");
            console.log("[DM3 APP] loginScreen hidden.");
        }

        const app = document.getElementById("app");

        if (app) {
            app.style.display = "block";
            app.style.visibility = "visible";
            app.style.opacity = "1";
            app.style.pointerEvents = "auto";
            app.classList.remove("hidden");
            console.log("[DM3 APP] #app visible.");
        } else {
            console.error("[DM3 APP] ERROR: #app tidak dijumpai!");
            return;
        }

        document.body.classList.remove("login-active");
        document.body.classList.add("app-active");

        try {

            console.log("[DM3 APP] Loading application data...");
            await loadApplicationData();
            console.log("[DM3 APP] Application data loaded successfully.");

        } catch (error) {
            console.error("[DM3 APP] LOAD ERROR:", error);
            showToast("Data DM3 gagal dimuatkan.", "error");
        }
    }


    /* ======================================================================
       28. UPDATE DASHBOARD COUNTERS
       ====================================================================== */

    function setCounter(ids, value) {

        if (!Array.isArray(ids)) {
            ids = [ids];
        }

        ids.forEach(function (id) {

            const element = $(id);

            if (element) {
                element.textContent = safeText(value ?? 0);
            }
        });
    }


    function updateAllCounters() {

        const dashboard = DM3_STATE.dashboard || {};

        const totalMembers = dashboard.totalMembers ?? DM3_STATE.members.length;
        const totalAJK = dashboard.totalAJK ?? DM3_STATE.ajk.length;
        const totalPrograms = dashboard.totalPrograms ?? DM3_STATE.programs.length;
        const totalAttendance = dashboard.totalAttendance ?? DM3_STATE.attendance.length;

        setCounter([
            "total-members", "totalMembers", "dashboard-total-members", "stat-total-members"
        ], totalMembers);

        setCounter([
            "total-ajk", "totalAJK", "dashboard-total-ajk", "stat-total-ajk"
        ], totalAJK);

        setCounter([
            "total-programs", "totalPrograms", "dashboard-total-programs", "stat-total-programs"
        ], totalPrograms);

        setCounter([
            "total-attendance", "totalAttendance", "dashboard-total-attendance", "stat-total-attendance"
        ], totalAttendance);

        setCounter([
            "active-members", "activeMembers"
        ], dashboard.activeMembers ?? DM3_STATE.members.filter(function (member) {
            return normalize(member.status ?? member.Status) === "aktif";
        }).length);

        setCounter([
            "active-ajk", "activeAJK"
        ], dashboard.activeAJK ?? DM3_STATE.ajk.filter(function (item) {
            return normalize(item.status) === "aktif";
        }).length);

        setCounter([
            "total-portfolio", "totalPortfolio"
        ], dashboard.totalPortfolio ?? DM3_STATE.portfolio.length);

        console.log("[DM3 COUNTERS] UPDATED");
    }


    /* ======================================================================
       29. DASHBOARD RENDER
       ====================================================================== */

        function renderDashboard() {

        const dashboard = DM3_STATE.dashboard || {};

        const annualFee = dashboard.annualFee ?? DM3_STATE.settings.annualFee ?? DM3_CONFIG.annualFee;

        setCounter([
            "dashboardAnnualFee", "annualFee", "associationAnnualFee"
        ], "RM" + Number(annualFee).toFixed(2));

        const programAttendance = dashboard.programAttendance || {};

        const attendanceContainer = $("program-attendance-chart") || $("programAttendanceChart");

        if (attendanceContainer && Object.keys(programAttendance).length === 0) {
            attendanceContainer.innerHTML = `
                <div style="text-align:center;padding:30px;opacity:.65;">
                    Tiada data kehadiran program.
                </div>
            `;
        }

        const blockDistribution = dashboard.blockDistribution || {};

        const blockContainer = $("block-distribution-chart") || $("blockDistributionChart");

        if (blockContainer && Object.keys(blockDistribution).length === 0) {
            blockContainer.innerHTML = `
                <div style="text-align:center;padding:30px;opacity:.65;">
                    Tiada data blok.
                </div>
            `;
        }

        // ==========================================================
        // RENDER KEHADIRAN TERKINI
        // ==========================================================
        renderRecentAttendance();
        // ==========================================================

        updateAllCounters();
    }


    /* ======================================================================
       RENDER KEHADIRAN TERKINI (Dashboard)
       ====================================================================== */

    function renderRecentAttendance() {

        const container = $("recentAttendance");

        if (!container) {
            return;
        }

        const attendance = Array.isArray(DM3_STATE.attendance)
            ? DM3_STATE.attendance
            : [];

        if (attendance.length === 0) {
            container.innerHTML = `
                <div style="text-align:center;padding:30px;color:#7a8495;">
                    <i class="fa-solid fa-clipboard-list" style="font-size:28px;opacity:.4;display:block;margin-bottom:10px;"></i>
                    Tiada rekod kehadiran.
                </div>
            `;
            return;
        }

        // Ambil 5 rekod terkini
        const recent = attendance.slice().reverse().slice(0, 5);

        let html = '<div style="display:flex;flex-direction:column;gap:8px;">';

        recent.forEach(function (record, index) {

            const nama = record.nama || record.Nama || "-";
            const rumah = record.noRumah || record["No Rumah"] || "-";
            const masa = record.masa || record.Masa || "-";
            const program = record.program || record.namaProgram || "-";

            html +=
                '<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f8fafc;border-radius:10px;border-left:3px solid #2563eb;">' +

                    // Nombor
                    '<div style="min-width:28px;height:28px;background:#2563eb;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;">' +
                        (index + 1) +
                    '</div>' +

                    // Maklumat
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="font-weight:700;color:#1e293b;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
                            escapeHTML(nama) +
                        '</div>' +
                        '<div style="font-size:11px;color:#64748b;margin-top:2px;">' +
                            'Rumah: ' + escapeHTML(rumah) +
                            ' • ' + escapeHTML(program) +
                        '</div>' +
                    '</div>' +

                    // Masa
                    '<div style="font-size:12px;color:#475569;font-weight:700;font-family:ui-monospace,monospace;white-space:nowrap;">' +
                        escapeHTML(masa) +
                    '</div>' +

                '</div>';
        });

        html += '</div>';

        // Footer dengan jumlah
        html +=
            '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #e5eaf1;text-align:center;font-size:12px;color:#64748b;">' +
                'Menunjukkan 5 rekod terkini dari <strong>' + attendance.length + '</strong> jumlah kehadiran.' +
            '</div>';

        container.innerHTML = html;
    }


    /* ======================================================================
       30. NAVIGATION MAP
       ====================================================================== */

    const MODULE_MAP = {
        dashboard: "page-dashboard",
        members: "page-ahli",
        ahli: "page-ahli",
        ajk: "page-ajk",
        portfolio: "page-portfolio",
        programs: "page-program",
        program: "page-program",
        attendance: "page-rfid",
        rfid: "page-rfid",
        statistics: "page-statistik",
        statistik: "page-statistik",
        settings: "page-tetapan",
        tetapan: "page-tetapan",
        association: "page-maklumat",
        maklumat: "page-maklumat"
    };


    /* ======================================================================
       31. GET MODULE PAGE
       ====================================================================== */

    function getModulePage(module) {

        const key = normalize(module);
        const pageId = MODULE_MAP[key];

        if (!pageId) {
            return null;
        }

        return $(pageId);
    }


    /* ======================================================================
       32. HIDE ALL PAGES
       ====================================================================== */

    function hideAllPages() {

        const pages = document.querySelectorAll(".page-section");

        pages.forEach(function (page) {
            page.classList.remove("active");
            page.style.display = "none";
        });
    }


    /* ======================================================================
       33. UPDATE MENU ACTIVE STATE
       ====================================================================== */

    function updateMenuActive(module) {

        const normalized = normalize(module);

        const menuItems = document.querySelectorAll("[data-module], [data-menu], [data-page]");

        menuItems.forEach(function (item) {

            const itemModule = normalize(
                item.dataset.module || item.dataset.menu || item.dataset.page || ""
            );

            item.classList.toggle("active", itemModule === normalized);
        });
    }


    /* ======================================================================
       34. RENDER CURRENT MODULE
       ====================================================================== */

    function renderCurrentModule() {

        const module = DM3_STATE.currentModule || "dashboard";

        console.log("[DM3 MODULE RENDER]:", module);

        switch (normalize(module)) {

            case "dashboard":
                renderDashboard();
                break;

            case "members":
            case "ahli":
                if (window.DM3_AHLI && typeof window.DM3_AHLI.render === "function") {
                    console.log("[DM3 NAVIGATION] AHLI.JS RENDER");
                    window.DM3_AHLI.render();
                } else {
                    console.warn("[DM3 NAVIGATION] DM3_AHLI belum tersedia.");
                }
                break;

            case "ajk":
                renderAJKModule();
                break;

            case "portfolio":
                renderPortfolioModule();
                break;

            case "program":
            case "programs":
                renderProgramsModule();
                break;

            case "attendance":
            case "rfid":
                renderAttendanceModule();
                break;

            case "statistics":
            case "statistik":
                renderStatisticsModule();
                break;

            case "association":
            case "maklumat":
                renderAssociationModule();
                break;

            case "settings":
            case "tetapan":
                renderSettingsModule();
                break;

            default:
                console.warn("[DM3 NAVIGATION] Unknown module:", module);
        }
    }


    /* ======================================================================
       35. NAVIGATE
       ====================================================================== */

    function navigateTo(module) {

        const requested = normalize(module) || "dashboard";

        const page = getModulePage(requested);

        console.log("DM3 NAVIGATE:", module, "=>", requested, "=>", page ? page.id : "NOT FOUND");

        if (!page) {
            console.warn("[DM3 NAVIGATION] Page tidak dijumpai:", requested);
            return false;
        }

        hideAllPages();

        page.classList.add("active");
        page.style.display = "";

        DM3_STATE.currentModule = requested;

        updateMenuActive(requested);

        console.log("DM3 TARGET FOUND:", requested, "=>", page.id, page);

        if (requested === "members" || requested === "ahli") {
            if (window.DM3_AHLI && typeof window.DM3_AHLI.render === "function") {
                window.DM3_AHLI.render();
            }
        } else {
            renderCurrentModule();
        }

        return true;
    }


    window.navigateTo = navigateTo;
    window.dm3Navigate = navigateTo;


    /* ======================================================================
       36. NAVIGATION EVENT HANDLER
       ====================================================================== */

    function handleNavigationClick(event) {

        const target = event.target.closest("[data-module], [data-menu], [data-page]");

        if (!target) {
            return;
        }

        const module = target.dataset.module || target.dataset.menu || target.dataset.page;

        if (!module) {
            return;
        }

        event.preventDefault();

        console.log("DM3 MENU CLICK:", module, "=>", normalize(module));

        navigateTo(module);
    }


    /* ======================================================================
       37. INITIALIZE NAVIGATION
       ====================================================================== */

    function initializeNavigation() {

        if (DM3_STATE.navigationInitialized) {
            return;
        }

        document.addEventListener("click", handleNavigationClick);

        window.showPage = navigateTo;
        window.showModule = navigateTo;

        DM3_STATE.navigationInitialized = true;

        console.log("========================================");
        console.log("DM3 NAVIGATION: READY");
        console.log("========================================");
    }


    /* ======================================================================
       38. INITIALIZE AHLI MODULE
       ====================================================================== */

    function initializeAhliModule() {

        if (DM3_STATE.ahliInitialized) {
            return;
        }

        if (window.DM3_AHLI && typeof window.DM3_AHLI.initialize === "function") {

            console.log("[DM3] INITIALIZING AHLI.JS");

            window.DM3_AHLI.initialize();

            DM3_STATE.ahliInitialized = true;

            window.DM3_AHLI.render();

        } else {
            console.warn("[DM3] ahli.js belum tersedia semasa initialization.");
        }
    }


    /* ======================================================================
       39. AJK RENDERER (fallback)
       ====================================================================== */

    function renderAJKModule() {

        const tbody = $("ajkTableBody");

        if (!tbody) {
            console.warn("[DM3 AJK] ajkTableBody tidak dijumpai.");
            return;
        }

        const data = Array.isArray(DM3_STATE.ajk) ? DM3_STATE.ajk : [];

        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="empty-table" style="text-align:center;padding:30px;">
                        Tiada rekod AJK.
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(function (item, index) {

            const nama = item.nama ?? item.Nama ?? "-";
            const jawatan = item.jawatan ?? item.Jawatan ?? "-";
            const rumah = item.noRumah ?? item["No Rumah"] ?? "-";
            const status = item.status ?? item.Status ?? "Aktif";

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td><strong>${escapeHTML(nama)}</strong></td>
                <td>${escapeHTML(jawatan)}</td>
                <td>${escapeHTML(rumah)}</td>
                <td>
                    <span class="status-badge ${
                        String(status).toLowerCase() === "aktif" ? "status-active" : "status-inactive"
                    }">
                        ${escapeHTML(status)}
                    </span>
                </td>
            `;

            row.dataset.ajkId = item.id ?? item.ahliId ?? "";
            row.dataset.memberId = item.ahliId ?? item.id ?? "";

            tbody.appendChild(row);
        });
    }


    /* ======================================================================
       40. PORTFOLIO RENDERER
       ====================================================================== */

    function renderPortfolioModule() {

        const tbody = $("portfolioTableBody");

        if (!tbody) {
            return;
        }

        const data = Array.isArray(DM3_STATE.portfolio) ? DM3_STATE.portfolio : [];

        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align:center;padding:30px;">
                        Tiada rekod portfolio.
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(function (item, index) {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHTML(item.nama ?? item.Nama ?? "-")}</td>
                <td>${escapeHTML(item.jawatan ?? item.Jawatan ?? "-")}</td>
                <td>${escapeHTML(item.portfolio ?? "-")}</td>
                <td>${escapeHTML(item.catatan ?? "-")}</td>
            `;

            tbody.appendChild(row);
        });
    }


    /* ======================================================================
       41. PROGRAM RENDERER
       ====================================================================== */

    async function renderProgramsModule() {

        console.log("[DM3 PROGRAM] Membuka modul Program...");

        if (typeof window.refreshPrograms === "function") {

            console.log("[DM3 PROGRAM] Refresh data daripada API...");

            const success = await window.refreshPrograms();

            if (success) {
                console.log("[DM3 PROGRAM] Data program berjaya dimuatkan:", DM3_STATE.programs);
                return true;
            }

            console.warn("[DM3 PROGRAM] refreshPrograms gagal.");
        }

        const tbody = $("programTableBody");

        if (!tbody) {
            console.warn("[DM3 PROGRAM] Table body tidak dijumpai.");
            return false;
        }

        const data = Array.isArray(DM3_STATE.programs) ? DM3_STATE.programs : [];

        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center;padding:30px;">
                        Tiada rekod program.
                    </td>
                </tr>
            `;
            return true;
        }

        data.forEach(function (item, index) {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHTML(item.id ?? "")}</td>
                <td>${escapeHTML(item.namaProgram ?? item.nama ?? item.Nama ?? "-")}</td>
                <td>${escapeHTML(item.tarikh ?? item.Tarikh ?? "-")}</td>
                <td>${escapeHTML(item.lokasi ?? item.tempat ?? item.venue ?? "-")}</td>
                <td>${escapeHTML(item.status ?? item.Status ?? "Aktif")}</td>
            `;

            tbody.appendChild(row);
        });

        return true;
    }


    /* ======================================================================
       42. ATTENDANCE RENDERER
       ====================================================================== */

    function renderAttendanceModule() {

        if (window.DM3_RFID && typeof window.DM3_RFID.init === "function") {
            window.DM3_RFID.init();
        }

        if (window.DM3_RFID && typeof window.DM3_RFID.loadPrograms === "function") {
            console.log("[DM3 RFID] Memuatkan senarai program...");
            window.DM3_RFID.loadPrograms();
        }

        const tbody = $("attendanceTableBody");

        if (!tbody) {
            return;
        }

        const data = Array.isArray(DM3_STATE.attendance) ? DM3_STATE.attendance : [];

        tbody.innerHTML = "";

        if (data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" style="text-align:center;padding:30px;">
                        Tiada rekod kehadiran.
                    </td>
                </tr>
            `;
            return;
        }

        data.forEach(function (item, index) {

            const row = document.createElement("tr");

            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${escapeHTML(item.uidRfid ?? item["UID RFID"] ?? "-")}</td>
                <td>${escapeHTML(item.nama ?? item.Nama ?? "-")}</td>
                <td>${escapeHTML(item.program ?? item.Program ?? "-")}</td>
                <td>${escapeHTML(item.tarikh ?? item.Tarikh ?? "-")}</td>
                <td>${escapeHTML(item.masa ?? item.Masa ?? "-")}</td>
            `;

            tbody.appendChild(row);
        });
    }


    /* ======================================================================
   43. STATISTICS RENDERER — AUTO REFRESH
   ====================================================================== */

function renderStatisticsModule() {

    // Render dulu dari cache (supaya nampak ada data)
    renderStatisticsCounters();

    // Kemudian refresh dari server (background)
    refreshStatisticsData();
}


function renderStatisticsCounters() {

    const dashboard = DM3_STATE.dashboard || {};

    const totalMembers = dashboard.totalMembers ?? DM3_STATE.members.length;
    const totalAJK = dashboard.totalAJK ?? DM3_STATE.ajk.length;
    const totalPrograms = dashboard.totalPrograms ?? DM3_STATE.programs.length;
    const totalAttendance = dashboard.totalAttendance ?? DM3_STATE.attendance.length;

    setCounter([
        "statistics-members", "statisticsMembers", "statMembers", "statsMembers"
    ], totalMembers);

    setCounter([
        "statistics-ajk", "statisticsAJK", "statAJK", "statsAJK"
    ], totalAJK);

    setCounter([
        "statistics-programs", "statisticsPrograms", "statPrograms", "statsPrograms"
    ], totalPrograms);

    setCounter([
        "statistics-attendance", "statisticsAttendance", "statAttendance", "statsAttendance"
    ], totalAttendance);

    renderBlockDistribution();
    renderProgramAttendance();
}


async function refreshStatisticsData() {

    console.log("[DM3 STATISTICS] Refresh dari server...");

    try {

        // Clear cache dulu
        if (typeof window.clearAPICache === "function") {
            window.clearAPICache();
        }

        // Panggil getDashboard untuk data terkini
        const response = await dm3Request("getDashboard", {});

        if (response && response.success === true) {

            DM3_STATE.dashboard = response.data || {};

            console.log("[DM3 STATISTICS] Data dikemaskini:", DM3_STATE.dashboard);

            // Render semula dengan data baru
            renderStatisticsCounters();
        }

    } catch (error) {
        console.warn("[DM3 STATISTICS] Refresh gagal:", error);
    }
}


    /* ======================================================================
       44. BLOCK DISTRIBUTION
       Paparan: Aras + Jumlah Ahli sahaja
       ====================================================================== */

    function renderBlockDistribution() {

        const container =
            $("block-distribution-chart") ||
            $("blockDistributionChart") ||
            $("blockDistribution");

        if (!container) {
            console.warn("[DM3] Container Taburan Blok tidak dijumpai.");
            return;
        }

        const distribution = DM3_STATE.dashboard?.blockDistribution || {};

        const entries = Object.entries(distribution);

        if (entries.length === 0) {
            container.innerHTML = `
                <div style="padding:25px;text-align:center;opacity:.6;">
                    Tiada data.
                </div>
            `;
            return;
        }

        // Cari nilai maximum untuk scaling bar
        let maxCount = 0;
        entries.forEach(function (item) {
            const c = Number(item[1]);
            if (c > maxCount) maxCount = c;
        });

        // Bina HTML
        let html = '<div style="display:flex;flex-direction:column;gap:10px;">';

        entries.forEach(function (item) {

            const aras = item[0];
            const count = Number(item[1]);
            const percent = maxCount > 0 ? (count / maxCount * 100) : 0;

            html +=
                '<div style="display:flex;align-items:center;gap:12px;">' +

                    // Label Aras
                    '<div style="min-width:90px;font-weight:800;color:#1e293b;font-size:14px;text-align:center;background:#eff6ff;padding:8px 14px;border-radius:8px;">' +
                        'Aras ' + escapeHTML(aras) +
                    '</div>' +

                    // Bar + Count
                    '<div style="flex:1;background:#f1f5f9;border-radius:10px;height:32px;position:relative;overflow:hidden;">' +
                        '<div style="width:' + percent + '%;height:100%;background:linear-gradient(90deg,#3b82f6,#2563eb);border-radius:10px;transition:width .3s;"></div>' +
                        '<div style="position:absolute;top:0;left:14px;line-height:32px;font-size:14px;font-weight:800;color:' + (percent > 25 ? '#ffffff' : '#0f172a') + ';z-index:2;">' +
                            count + ' ahli' +
                        '</div>' +
                    '</div>' +

                '</div>';
        });

        html += '</div>';

        container.innerHTML = html;
    }


    /* ======================================================================
       45. PROGRAM ATTENDANCE
       ====================================================================== */

    function renderProgramAttendance() {

        const container =
            $("program-attendance-chart") ||
            $("programAttendanceChart") ||
            $("programAttendance");

        if (!container) {
            console.warn("[DM3] Container Kehadiran Program tidak dijumpai.");
            return;
        }

        const data = DM3_STATE.dashboard?.programAttendance || {};

        const entries = Object.entries(data);

        if (entries.length === 0) {
            container.innerHTML = `
                <div style="padding:25px;text-align:center;opacity:.6;">
                    Tiada data kehadiran program.
                </div>
            `;
            return;
        }

        container.innerHTML = "";

        entries.forEach(function (item) {

            const name = item[0];
            const count = Number(item[1]);

            const row = document.createElement("div");
            row.style.display = "flex";
            row.style.justifyContent = "space-between";
            row.style.padding = "10px 0";
            row.style.borderBottom = "1px solid #e5e7eb";

            row.innerHTML = `
                <span>${escapeHTML(name)}</span>
                <strong>${count}</strong>
            `;

            container.appendChild(row);
        });
    }


    /* ======================================================================
       46. ASSOCIATION MODULE
       ====================================================================== */

    function renderAssociationModule() {

        const settings = DM3_STATE.settings || {};

        const associationName = settings.associationName || DM3_CONFIG.associationName;
        const appName = settings.appName || DM3_CONFIG.appName;
        const annualFee = settings.annualFee ?? DM3_CONFIG.annualFee;

        const fields = {
            associationName: ["associationName", "association-name", "infoAssociationName"],
            appName: ["appName", "app-name", "infoAppName"],
            annualFee: ["annualFee", "annual-fee", "infoAnnualFee"]
        };

        fields.associationName.forEach(function (id) {
            const element = $(id);
            if (element) {
                element.textContent = associationName;
            }
        });

        fields.appName.forEach(function (id) {
            const element = $(id);
            if (element) {
                element.textContent = appName;
            }
        });

        fields.annualFee.forEach(function (id) {
            const element = $(id);
            if (element) {
                element.textContent = "RM" + Number(annualFee).toFixed(2);
            }
        });
    }


    /* ======================================================================
       47. SETTINGS MODULE
       ====================================================================== */

    function renderSettingsModule() {

        const settings = DM3_STATE.settings || {};

        const appName = $("settingsAppName");
        const associationName = $("settingsAssociationName");
        const annualFee = $("settingsAnnualFee");

        if (appName) {
            appName.value = settings.appName || DM3_CONFIG.appName;
        }

        if (associationName) {
            associationName.value = settings.associationName || DM3_CONFIG.associationName;
        }

        if (annualFee) {
            annualFee.value = settings.annualFee ?? DM3_CONFIG.annualFee;
        }
    }


    /* ======================================================================
       48. SAVE SETTINGS
       ====================================================================== */

    async function saveSettings() {

        const data = {
            appName: $("settingsAppName")?.value?.trim() || DM3_CONFIG.appName,
            associationName: $("settingsAssociationName")?.value?.trim() || DM3_CONFIG.associationName,
            annualFee: Number($("settingsAnnualFee")?.value ?? DM3_CONFIG.annualFee)
        };

        try {

            showLoading("Menyimpan settings...");

            const response = await dm3Request("saveSettings", data);

            if (!response || response.success !== true) {
                throw new Error(response?.message || "Gagal menyimpan settings.");
            }

            DM3_STATE.settings = response.data || data;

            saveLocalState();

            renderAssociationModule();

            showToast(response.message || "Settings berjaya disimpan.", "success");

        } catch (error) {

            console.error("[DM3 SETTINGS] ERROR:", error);

            showToast(error.message || "Gagal menyimpan settings.", "error");

        } finally {
            hideLoading();
        }
    }


    /* ======================================================================
       49. REFRESH ALL DATA
       ====================================================================== */

    async function refreshAllData() {

        if (DM3_STATE.loadingData) {
            return;
        }

        try {

            showLoading("Mengemaskini data DM3...");

            await Promise.all([
                loadMembers(),
                loadAJK(),
                loadPortfolio(),
                loadPrograms(),
                loadAttendance(),
                loadSettings(),
                loadDashboard()
            ]);

            saveLocalState();

            updateAllCounters();

            renderCurrentModule();

            if (window.DM3_AHLI && typeof window.DM3_AHLI.render === "function") {
                window.DM3_AHLI.render();
            }

            showToast("Data DM3 berjaya dikemaskini.", "success");

        } catch (error) {

            console.error("[DM3 REFRESH] ERROR:", error);

            showToast(error.message || "Gagal mengemaskini data.", "error");

        } finally {
            hideLoading();
        }
    }


    /* ======================================================================
       50. GLOBAL BUTTONS
       ====================================================================== */

    function initializeGlobalButtons() {

        if (DM3_STATE.globalButtonsInitialized) {
            return;
        }

        document.addEventListener("click", function (event) {

            const logoutButton = event.target.closest(
                "[data-action='logout'], #logout-btn, #logoutButton"
            );

            if (logoutButton) {
                event.preventDefault();
                logout();
                return;
            }

            const refreshButton = event.target.closest(
    "[data-action='refresh'], #refresh-btn, #refreshButton, #syncButton, #sync-btn, [data-action='sync']"
);

            if (refreshButton) {
                event.preventDefault();
                refreshAllData();
                return;
            }

            const saveSettingsButton = event.target.closest(
                "[data-action='save-settings'], #save-settings-btn"
            );

            if (saveSettingsButton) {
                event.preventDefault();
                saveSettings();
                return;
            }
        });

        DM3_STATE.globalButtonsInitialized = true;
    }


    /* ======================================================================
       51. USER DISPLAY
       ====================================================================== */

    function updateCurrentUserDisplay() {

        const user = DM3_STATE.currentUser || {};

        const name = user.nama || user.Nama || user.username || "Pentadbir";
        const username = user.username || "";
        const role = user.role || user.Role || user.status || user.Status || "";

        const nameElements = document.querySelectorAll(
            "[data-current-user-name], #current-user-name, #user-name, #loggedUserName"
        );

        nameElements.forEach(function (element) {
            element.textContent = name;
        });

        const usernameElements = document.querySelectorAll(
            "[data-current-user-username], #current-user-username"
        );

        usernameElements.forEach(function (element) {
            element.textContent = username;
        });

        const roleElements = document.querySelectorAll(
            "[data-current-user-role], #current-user-role"
        );

        roleElements.forEach(function (element) {
            element.textContent = role;
        });
    }


    /* ======================================================================
       52. NETWORK STATUS
       ====================================================================== */

    function updateNetworkStatus(online = true) {

        const elements = document.querySelectorAll(
            "#network-status, [data-network-status]"
        );

        elements.forEach(function (element) {

            element.textContent = online ? "ONLINE" : "OFFLINE";
            element.classList.toggle("online", online);
            element.classList.toggle("offline", !online);
        });
    }


    /* ======================================================================
       53. RFID STATE
       ====================================================================== */

    function updateRFIDStatus(connected) {

        DM3_STATE.rfidConnected = Boolean(connected);

        const elements = document.querySelectorAll(
            "#rfid-status, [data-rfid-status]"
        );

        elements.forEach(function (element) {

            element.textContent = DM3_STATE.rfidConnected ? "CONNECTED" : "DISCONNECTED";
            element.classList.toggle("connected", DM3_STATE.rfidConnected);
            element.classList.toggle("disconnected", !DM3_STATE.rfidConnected);
        });
    }


    /* ======================================================================
       54. RFID TEST MODE
       ====================================================================== */

    function setRFIDMode(enabled) {

        DM3_STATE.rfidMode = Boolean(enabled);

        const elements = document.querySelectorAll("[data-rfid-mode]");

        elements.forEach(function (element) {
            element.textContent = DM3_STATE.rfidMode ? "TEST MODE" : "NORMAL MODE";
        });
    }


    /* ======================================================================
       55. MANUAL ATTENDANCE MODAL
       ====================================================================== */

    function closeManualAttendanceModal() {

        console.log("[DM3 RFID] Closing Manual Attendance Modal...");

        const modal = document.getElementById("manualAttendanceModal") ||
                      document.getElementById("dm3ManualAttendanceModal");

        if (!modal) {
            console.warn("[DM3 RFID] Manual attendance modal tidak dijumpai.");
            return;
        }

        modal.classList.remove("show");
        modal.classList.remove("active");
        modal.classList.remove("open");
        modal.classList.add("hidden");

        modal.style.display = "none";
        modal.style.visibility = "hidden";
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";

        document.body.classList.remove("dm3-modal-open");
        document.body.classList.remove("modal-open");
        document.body.style.overflow = "";

        console.log("[DM3 RFID] Manual Attendance CLOSED");
    }


    function openManualAttendanceModal() {

        console.log("[DM3 RFID] Opening Manual Attendance Modal...");

        const modal = document.getElementById("manualAttendanceModal") ||
                      document.getElementById("dm3ManualAttendanceModal");

        if (!modal) {
            console.warn("[DM3 RFID] Manual attendance modal tidak dijumpai.");
            return;
        }

        modal.classList.remove("hidden");
        modal.classList.add("show");
        modal.classList.add("active");

        modal.style.display = "flex";
        modal.style.visibility = "visible";
        modal.style.opacity = "1";
        modal.style.pointerEvents = "auto";

        document.body.classList.add("dm3-modal-open");
        document.body.classList.add("modal-open");

        console.log("[DM3 RFID] Manual Attendance OPEN");
    }


    /* ======================================================================
       56. RFID BUTTONS
       ====================================================================== */

    function initializeRFIDHandlers() {

        console.log("[DM3 RFID] INITIALIZING RFID HANDLERS");

        document.addEventListener("click", function (event) {

            const manualButton = event.target.closest(
                "#manual-attendance-btn, [data-action='manual-attendance']"
            );

            if (manualButton) {
                event.preventDefault();
                event.stopPropagation();
                console.log("[DM3 RFID] OPEN MANUAL ATTENDANCE");
                openManualAttendanceModal();
                return;
            }

            const closeButton = event.target.closest(`
    [data-close-modal="manualAttendanceModal"],
    [data-close-manual-attendance],
    #closeManualAttendance,
    #manualAttendanceModal .modal-close
`);

if (closeButton && closeButton.closest("#manualAttendanceModal")) {
    event.preventDefault();
    event.stopPropagation();
    console.log("[DM3 RFID] CLOSE BUTTON CLICKED");
    closeManualAttendanceModal();
    return;
}

            const testButton = event.target.closest(
                "#rfid-test-mode, [data-action='rfid-test']"
            );

            if (testButton) {
                event.preventDefault();
                event.stopPropagation();
                setRFIDMode(!DM3_STATE.rfidMode);
                showToast(
                    DM3_STATE.rfidMode ? "RFID Test Mode diaktifkan." : "RFID Test Mode dimatikan.",
                    "info"
                );
                return;
            }
        }, true);

        document.addEventListener("keydown", function (event) {

            if (event.key !== "Escape") {
                return;
            }

            const modal = document.getElementById("manualAttendanceModal");

            if (!modal) {
                return;
            }

            const isOpen = modal.classList.contains("show") ||
                           modal.classList.contains("active") ||
                           modal.style.display === "flex";

            if (isOpen) {
                console.log("[DM3 RFID] ESC - CLOSING MANUAL ATTENDANCE");
                closeManualAttendanceModal();
            }
        });

        const manualModal = document.getElementById("manualAttendanceModal");

        if (manualModal) {
            manualModal.addEventListener("click", function (event) {
                if (event.target === manualModal) {
                    closeManualAttendanceModal();
                }
            });
        }

        console.log("DM3 RFID HANDLER: READY");
    }


    /* ======================================================================
       57. OFFLINE SYNC BADGE
       ====================================================================== */

    function getPendingSyncCount() {

        try {

            const raw = localStorage.getItem("DM3_PENDING_SYNC");

            if (!raw) {
                return 0;
            }

            const data = JSON.parse(raw);

            return Array.isArray(data) ? data.length : 0;

        } catch (error) {
            console.warn("[DM3 SYNC] Cannot read pending sync:", error);
            return 0;
        }
    }


    function updatePendingSyncBadge() {

        const count = getPendingSyncCount();

        const elements = document.querySelectorAll(
            "#pending-sync-count, [data-pending-sync-count]"
        );

        elements.forEach(function (element) {
            element.textContent = count;
            element.style.display = count > 0 ? "" : "none";
        });

        console.log("[DM3 SYNC] Pending:", count);
    }


    /* ======================================================================
       58. ONLINE / OFFLINE EVENTS
       ====================================================================== */

    function initializeNetworkHandlers() {

        window.addEventListener("online", function () {
            updateNetworkStatus(true);
            updatePendingSyncBadge();
        });

        window.addEventListener("offline", function () {
            updateNetworkStatus(false);
        });

        document.addEventListener("click", function (event) {

            const button = event.target.closest("#sync-now-btn, [data-action='sync']");

            if (button) {
                event.preventDefault();
                syncPendingData();
            }
        });

        updateNetworkStatus(navigator.onLine);
        updatePendingSyncBadge();
    }


    /* ======================================================================
       59. AHLI REFRESH COMPATIBILITY
       ====================================================================== */

    function refreshAhli() {

        if (window.DM3_AHLI && typeof window.DM3_AHLI.refresh === "function") {
            return window.DM3_AHLI.refresh(true);
        }

        return loadMembers();
    }


    window.refreshDM3Ahli = refreshAhli;


    /* ======================================================================
       60. AHLI ADD COMPATIBILITY
       ====================================================================== */

    function addAhli() {

        if (window.DM3_AHLI && typeof window.DM3_AHLI.add === "function") {
            window.DM3_AHLI.add();
            return;
        }

        console.warn("[DM3] DM3_AHLI.add belum tersedia.");
    }


    window.openDM3AhliModal = addAhli;


    /* ======================================================================
       61. AHLI EDIT COMPATIBILITY
       ====================================================================== */

    window.editDM3Ahli = function (id) {

        if (window.DM3_AHLI && typeof window.DM3_AHLI.edit === "function") {
            window.DM3_AHLI.edit(id);
        }
    };


    /* ======================================================================
       62. AHLI DELETE COMPATIBILITY
       ====================================================================== */

    window.deleteDM3Ahli = function (id) {

        if (window.DM3_AHLI && typeof window.DM3_AHLI.remove === "function") {
            return window.DM3_AHLI.remove(id);
        }
    };


    /* ======================================================================
       63. CURRENT USER PUBLIC ACCESS
       ====================================================================== */

    window.getDM3CurrentUser = function () {
        return DM3_STATE.currentUser;
    };


    /* ======================================================================
       64. APPLICATION STATE PUBLIC ACCESS
       ====================================================================== */

    window.getDM3State = function () {
        return DM3_STATE;
    };


    /* ======================================================================
       65. REFRESH DASHBOARD
       ====================================================================== */

    async function refreshDashboard() {

        try {

            const response = await dm3Request("getDashboard", {});

            if (response && response.success === true) {

                DM3_STATE.dashboard = response.data || {};

                renderDashboard();

                if (DM3_STATE.currentModule === "dashboard") {
                    renderCurrentModule();
                }
            }

        } catch (error) {
            console.error("[DM3 DASHBOARD] REFRESH ERROR:", error);
        }
    }


    window.refreshDM3Dashboard = refreshDashboard;


    /* ======================================================================
       66. REFRESH MEMBERS WITHOUT REPLACING AHLI RENDERER
       ====================================================================== */

    async function refreshMembersOnly() {

        try {

            const response = await dm3Request("getMembers", {});

            if (!response || response.success !== true) {
                throw new Error(response?.message || "Gagal mengambil data ahli.");
            }

            DM3_STATE.members = Array.isArray(response.data) ? response.data : [];

            saveLocalState();
            updateAllCounters();

            if (window.DM3_AHLI && typeof window.DM3_AHLI.render === "function") {
                window.DM3_AHLI.render();
            }

            return DM3_STATE.members;

        } catch (error) {

            console.error("[DM3 MEMBERS] REFRESH ERROR:", error);

            showToast(error.message || "Gagal memuatkan ahli.", "error");

            return [];
        }
    }


    window.loadDM3Members = refreshMembersOnly;


    /* ======================================================================
       67. PREVENT DOUBLE INITIALIZATION
       ====================================================================== */

    function ensureLoginState() {

        if (DM3_STATE.loggedIn) {
            return true;
        }

        const user = getStoredUser();

        if (user && localStorage.getItem(DM3_CONFIG.rememberKey) === "1") {

            DM3_STATE.loggedIn = true;
            DM3_STATE.currentUser = user;

            return true;
        }

        return false;
    }


    /* ======================================================================
       68. INITIALIZE APPLICATION
       ====================================================================== */

    async function initializeDM3Application() {

        console.log("========================================");
        console.log("DM3 V4.3 CLEAN INITIALIZATION");
        console.log("========================================");

        initializeNavigation();
        initializeLogin();
        initializePasswordToggle();
        initializeGlobalButtons();
        initializeRFIDHandlers();
        initializeNetworkHandlers();
        initializeAhliModule();
        updateCurrentUserDisplay();

        const remembered = checkRememberedLogin();

        if (remembered) {
            console.log("[DM3 V4.3] REMEMBERED USER -> LOAD APP");
            updateCurrentUserDisplay();
            await showMainApplication();
            return;
        }

        showLoginScreen();
        hideLoading();

        console.log("========================================");
        console.log("DM3 V4.3 CLEAN READY");
        console.log("========================================");
    }


    /* ======================================================================
       69. DOM READY
       ====================================================================== */

    function dm3DOMReady() {

        console.log("========================================");
        console.log("DM3 V4.3 CLEAN DOM READY");
        console.log("========================================");

        initializeDM3Application();
    }


    /* ======================================================================
       70. GLOBAL PUBLIC API
       ====================================================================== */

    window.DM3_APP = {
        version: DM3_CONFIG.version,
        state: DM3_STATE,
        config: DM3_CONFIG,
        request: dm3Request,
        login: processLogin,
        logout: logout,
        navigate: navigateTo,
        refresh: refreshAllData,
        refreshMembers: refreshMembersOnly,
        refreshDashboard: refreshDashboard,
        showLoading: showLoading,
        hideLoading: hideLoading,
        showToast: showToast,
        render: renderCurrentModule
    };


    /* ======================================================================
       71. GLOBAL FUNCTION COMPATIBILITY
       ====================================================================== */

    window.performDM3Login = async function () {

        const usernameInput = getLoginUsernameInput();
        const passwordInput = getLoginPasswordInput();
        const rememberInput = getRememberCheckbox();

        return processLogin(
            usernameInput ? usernameInput.value.trim() : "",
            passwordInput ? passwordInput.value : "",
            rememberInput ? Boolean(rememberInput.checked) : false
        );
    };

    window.logoutDM3 = logout;
    window.loadApplicationData = loadApplicationData;
    window.updateAllCounters = updateAllCounters;
    window.renderCurrentModule = renderCurrentModule;
    window.renderDashboard = renderDashboard;
    window.renderAJKModule = renderAJKModule;
    window.renderPortfolioModule = renderPortfolioModule;
    window.renderProgramsModule = renderProgramsModule;
    window.renderAttendanceModule = renderAttendanceModule;
    window.renderStatisticsModule = renderStatisticsModule;
    window.renderAssociationModule = renderAssociationModule;
    window.renderSettingsModule = renderSettingsModule;
    window.saveDM3Settings = saveSettings;
    window.refreshDM3Data = refreshAllData;


    /* ======================================================================
       72. LEGACY COMPATIBILITY
       ====================================================================== */

    window.showDashboard = function () { return navigateTo("dashboard"); };
    window.showMembers = function () { return navigateTo("members"); };
    window.showAJK = function () { return navigateTo("ajk"); };
    window.showPortfolio = function () { return navigateTo("portfolio"); };
    window.showPrograms = function () { return navigateTo("programs"); };
    window.showAttendance = function () { return navigateTo("attendance"); };
    window.showStatistics = function () { return navigateTo("statistics"); };
    window.showAssociation = function () { return navigateTo("association"); };
    window.showSettings = function () { return navigateTo("settings"); };


    /* ======================================================================
       73. DEBUG INFORMATION
       ====================================================================== */

    window.DM3_DEBUG = function () {

        console.log("========================================");
        console.log("DM3 DEBUG INFORMATION");
        console.log("========================================");
        console.log("Version:", DM3_CONFIG.version);
        console.log("Logged In:", DM3_STATE.loggedIn);
        console.log("Current User:", DM3_STATE.currentUser);
        console.log("Current Module:", DM3_STATE.currentModule);
        console.log("Members:", DM3_STATE.members.length);
        console.log("AJK:", DM3_STATE.ajk.length);
        console.log("Portfolio:", DM3_STATE.portfolio.length);
        console.log("Programs:", DM3_STATE.programs.length);
        console.log("Attendance:", DM3_STATE.attendance.length);
        console.log("AHLI Renderer:", Boolean(window.DM3_AHLI));
        console.log("AHLI Render Function:", Boolean(window.DM3_AHLI && typeof window.DM3_AHLI.render === "function"));
        console.log("========================================");
    };


    /* ======================================================================
       74. FINAL SAFETY CHECK
       ====================================================================== */

    function finalSafetyCheck() {

        const table = $("membersTableBody");

        if (table && window.DM3_AHLI && typeof window.DM3_AHLI.render === "function") {

            console.log("[DM3 SAFETY] AHLI.JS IS PRIMARY RENDERER");

            if (DM3_STATE.members.length > 0) {
                window.DM3_AHLI.render();
            }
        }

        updateAllCounters();
        updateNetworkStatus(navigator.onLine);
        updatePendingSyncBadge();
    }


    /* ======================================================================
       75. START APPLICATION
       ====================================================================== */

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", dm3DOMReady, { once: true });
    } else {
        dm3DOMReady();
    }


    setTimeout(function () {
        try {
            finalSafetyCheck();
        } catch (error) {
            console.error("[DM3 SAFETY CHECK] ERROR:", error);
        }
    }, 300);


    /* ======================================================================
       76. FINAL LOG
       ====================================================================== */

    console.log("========================================");
    console.log("DM3 SCRIPT.JS V4.3 CLEAN LOADED");
    console.log("API_CONFIG: PROVIDED BY api.js");
    console.log("PASSWORD TOGGLE: READY");
    console.log("LOGIN HANDLER: READY");
    console.log("RFID HANDLER: READY");
    console.log("AHLI.JS: PRIMARY RENDERER");
    console.log("NO SCRIPT.JS AHLI TABLE RENDERER");
    console.log("========================================");

})();