/* ==========================================================================
   DM3 MANAGEMENT SYSTEM
   API.JS V5.0 QUEUE EDITION
   Persatuan Penduduk Desa Mentari 3

   PERUBAHAN V5.0:
   - REQUEST QUEUE: Hantar request SATU-SATU ke Apps Script
   - Elak 404 overload akibat terlalu banyak request serentak
   - Jeda 1500ms antara request
   - Semua fix V4.9 dikekalkan
   - Request Deduplication
   - Pre-login Block
   - Authentication Gate
   - Retry logic untuk 404 / timeout
   - Validasi "DM3 API ONLINE" untuk elak respons salah
========================================================================== */


/* ==========================================================================
   1. API CONFIGURATION
========================================================================== */

const API_CONFIG = {
    mode: "GOOGLE",
    googleAppsScriptUrl: "https://script.google.com/macros/s/AKfycbxoJ0kCuyN5TYAxvYLa0IhJAts7LVh4Tb2zgfDLgirTg-WNL45b60KTICanLEPfklCK/exec",
    timeout: 90000,
    appName: "DM3 Management System",
    debug: true,

    /* Queue settings */
    queueDelay: 1500,
    queueMaxRetries: 3
};

window.API_CONFIG = API_CONFIG;


/* ==========================================================================
   2. STORAGE KEYS
========================================================================== */

const API_STORAGE = {
    members: "DM3_members",
    ajk: "DM3_ajk",
    portfolio: "DM3_portfolio",
    programs: "DM3_programs",
    attendance: "DM3_attendance",
    settings: "DM3_settings",
    syncQueue: "DM3_sync_queue"
};

window.API_STORAGE = API_STORAGE;


/* ==========================================================================
   3. DEFAULT DATA
========================================================================== */

const DEFAULT_DATA = {
    members: [],
    ajk: [],
    portfolio: [],
    programs: [],
    attendance: [],
    settings: {
        annualFee: 15,
        associationName: "Persatuan Penduduk Desa Mentari 3",
        associationShortName: "DM3"
    },
    syncQueue: []
};


/* ==========================================================================
   4. API STATE
========================================================================== */

const API_STATE = {
    connected: false,
    lastSync: null,
    pendingSync: 0,
    lastError: null
};

window.API_STATE = API_STATE;


/* ==========================================================================
   5. REQUEST QUEUE SYSTEM
========================================================================== */

const API_QUEUE = [];
let API_QUEUE_RUNNING = false;

function enqueueAPIRequest(taskFn, label) {
    return new Promise(function (resolve, reject) {
        API_QUEUE.push({
            taskFn: taskFn,
            resolve: resolve,
            reject: reject,
            label: label || "unknown",
            queuedAt: Date.now()
        });

        if (API_CONFIG.debug) {
            console.log(
                "[DM3 QUEUE] Enqueue:",
                label,
                "| Panjang queue:",
                API_QUEUE.length,
                "| Running:",
                API_QUEUE_RUNNING
            );
        }

        runAPIQueue();
    });
}

async function runAPIQueue() {
    if (API_QUEUE_RUNNING) return;
    if (API_QUEUE.length === 0) return;

    API_QUEUE_RUNNING = true;

    while (API_QUEUE.length > 0) {
        const item = API_QUEUE.shift();

        if (API_CONFIG.debug) {
            console.log(
                "[DM3 QUEUE] Process:",
                item.label,
                "| Baki:",
                API_QUEUE.length
            );
        }

        try {
            const result = await item.taskFn();
            item.resolve(result);
        } catch (error) {
            item.reject(error);
        }

        if (API_QUEUE.length > 0) {
            await new Promise(function (r) {
                setTimeout(r, API_CONFIG.queueDelay);
            });
        }
    }

    API_QUEUE_RUNNING = false;

    if (API_CONFIG.debug) {
        console.log("[DM3 QUEUE] Kosong. Sedia untuk request baru.");
    }
}

window.__DM3_QUEUE_STATUS = function () {
    return {
        pending: API_QUEUE.length,
        running: API_QUEUE_RUNNING,
        delay: API_CONFIG.queueDelay
    };
};


/* ==========================================================================
   6. AUTHENTICATION GATE
========================================================================== */

function isDM3Authenticated() {
    try {
        if (
            typeof DM3_STATE !== "undefined" &&
            DM3_STATE &&
            DM3_STATE.loggedIn === true
        ) {
            return true;
        }
    } catch (error) {}

    const sessionKeys = [
        "DM3_AUTH_USER",
        "DM3_session",
        "DM3_currentUser",
        "DM3_USER",
        "DM3_AUTH",
        "DM3_LOGIN"
    ];

    for (const key of sessionKeys) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) continue;

            if (key === "DM3_AUTH" || key === "DM3_LOGIN") {
                return true;
            }

            const parsed = JSON.parse(raw);
            if (parsed) return true;
        } catch (error) {}
    }

    return false;
}

window.isDM3Authenticated = isDM3Authenticated;


function isDM3PublicAction(action) {
    return ["ping", "login"].includes(
        String(action || "").trim().toLowerCase()
    );
}

window.isDM3PublicAction = isDM3PublicAction;


/* ==========================================================================
   7. INITIALIZE LOCAL STORAGE
========================================================================== */

function initializeLocalStorage() {
    Object.keys(DEFAULT_DATA).forEach(function (key) {
        const storageKey = API_STORAGE[key];
        if (!storageKey) return;

        const existing = localStorage.getItem(storageKey);
        if (existing === null) {
            localStorage.setItem(
                storageKey,
                JSON.stringify(DEFAULT_DATA[key])
            );
        }
    });
}


/* ==========================================================================
   8. CHECK API CONFIGURATION
========================================================================== */

function checkAPIConfiguration() {
    if (API_CONFIG.mode === "GOOGLE") {
        if (!API_CONFIG.googleAppsScriptUrl) {
            console.warn("[DM3 API] Google Apps Script URL belum diisi.");
            API_STATE.connected = false;
            return;
        }
    }

    if (API_CONFIG.mode === "LOCAL") {
        API_STATE.connected = true;
    }
}


/* ==========================================================================
   9. INITIALIZE API
========================================================================== */

function initializeAPI() {
    try {
        initializeLocalStorage();
        updatePendingSyncCount();
        checkAPIConfiguration();

        if (API_CONFIG.debug) {
            console.log("========================================");
            console.log("DM3 API.JS V5.0 QUEUE EDITION");
            console.log("API OBJECT READY");
            console.log("========================================");
            console.log("Mode:", API_CONFIG.mode);
            console.log(
                "Google Apps Script URL:",
                API_CONFIG.googleAppsScriptUrl ? "Configured" : "Not configured"
            );
            console.log("Request Deduplication: ENABLED");
            console.log("Request Queue: ENABLED (" + API_CONFIG.queueDelay + "ms delay)");
            console.log("Pre-login Data Requests: BLOCKED");
            console.log("========================================");
        }
    } catch (error) {
        console.error("[DM3 API V5.0] Initialization error:", error);
        API_STATE.lastError = error;
    }
}


/* ==========================================================================
   10. GENERIC API REQUEST (Wrapper dengan Queue + Cache)
========================================================================== */

const DM3_REQUESTS = new Map();

/* ==========================================================================
   FRONTEND CACHE — Simpan data 5 minit supaya tak request berulang
========================================================================== */

const API_CACHE = new Map();
const API_CACHE_TTL = 5 * 60 * 1000; // 5 minit

function getCachedResult(action, data) {
    const key = action + "::" + JSON.stringify(data || {});
    const entry = API_CACHE.get(key);

    if (entry && (Date.now() - entry.time) < API_CACHE_TTL) {
        if (API_CONFIG.debug) {
            console.log("[DM3 CACHE] Hit:", action);
        }
        return entry.result;
    }

    return null;
}

function setCachedResult(action, data, result) {
    const key = action + "::" + JSON.stringify(data || {});
    API_CACHE.set(key, {
        time: Date.now(),
        result: result
    });

    if (API_CONFIG.debug) {
        console.log("[DM3 CACHE] Set:", action);
    }
}

function clearAPICache() {
    API_CACHE.clear();
    if (API_CONFIG.debug) {
        console.log("[DM3 CACHE] Cleared.");
    }
}

window.clearAPICache = clearAPICache;


function getRequestKey(action, data, method) {
    let serialized = "{}";
    try {
        serialized = JSON.stringify(data || {});
    } catch (error) {
        serialized = String(data || "");
    }

    return [
        String(method || "POST").toUpperCase(),
        String(action || ""),
        serialized
    ].join("::");
}


async function apiRequest(action, data, method) {
    data = data || {};
    method = method || "POST";

    const cleanAction = String(action || "").trim();
    const requestMethod = String(method).toUpperCase() === "GET" ? "GET" : "POST";

    if (!cleanAction) {
        throw new Error("API action tidak ditetapkan.");
    }

    // ==========================================================
    // TAMBAH TOKEN UNTUK ACTION PRIVATE
    // ==========================================================
    const publicActions = ["ping", "test", "login", "authenticate", "auth"];

    if (publicActions.indexOf(cleanAction) === -1) {
        const token = getStoredDM3Token();
        if (token) {
            data.token = token;
        }
    }
    // ==========================================================

    /* LOCAL MODE */
    if (API_CONFIG.mode === "LOCAL") {
        return localAPIRequest(cleanAction, data);
    }

    /* GOOGLE MODE */
    if (!API_CONFIG.googleAppsScriptUrl) {
        throw new Error("Google Apps Script URL belum ditetapkan.");
    }

    /* AUTHENTICATION GATE */
    if (!isDM3PublicAction(cleanAction) && !isDM3Authenticated()) {
        if (API_CONFIG.debug) {
            console.log("[DM3 API V5.0] BLOCK PRE-LOGIN REQUEST:", cleanAction);
        }

        return {
            success: true,
            preLogin: true,
            data: [],
            message: "Request ditangguhkan sehingga login berjaya."
        };
    }

    /* ==========================================================
       CACHE CHECK — untuk action GET sahaja
       ========================================================== */
    const isCacheable = [
        "getMembers",
        "getAJK",
        "getPortfolio",
        "getPrograms",
        "getAttendance",
        "getSettings",
        "getDashboard"
    ].includes(cleanAction);

    if (isCacheable) {
        const cached = getCachedResult(cleanAction, data);
        if (cached) {
            return cached;
        }
    }

    /* DEDUPLICATION */
    const requestKey = getRequestKey(cleanAction, data, requestMethod);

    if (DM3_REQUESTS.has(requestKey)) {
        if (API_CONFIG.debug) {
            console.log("[DM3 API V5.0] USING EXISTING REQUEST:", cleanAction);
        }
        return DM3_REQUESTS.get(requestKey);
    }

    /* CREATE REQUEST — GUNA QUEUE */
    const requestPromise = enqueueAPIRequest(
        function () {
            return executeAPIRequestInternal(cleanAction, data, requestMethod);
        },
        cleanAction
    );

    DM3_REQUESTS.set(requestKey, requestPromise);

    try {
        const result = await requestPromise;

        /* Simpan ke cache jika boleh */
        if (isCacheable && result && result.success !== false) {
            setCachedResult(cleanAction, data, result);
        }

        return result;

    } finally {
        if (DM3_REQUESTS.get(requestKey) === requestPromise) {
            DM3_REQUESTS.delete(requestKey);
        }
    }
}

window.apiRequest = apiRequest;
window.dm3ApiRequest = apiRequest;


/* ==========================================================================
   11. EXECUTE API REQUEST — INTERNAL
========================================================================== */

async function executeAPIRequestInternal(action, data, method) {
    if (API_CONFIG.debug) {
        console.log("[DM3 API V5.0] REQUEST:", action, data);
    }

    if (String(API_CONFIG.mode || "").toUpperCase() === "LOCAL") {
        return localAPIRequest(action, data);
    }

    if (!API_CONFIG.googleAppsScriptUrl) {
        throw new Error("Google Apps Script URL belum ditetapkan.");
    }

    return fetchGoogleAPI(action, data, method);
}


/* ==========================================================================
   12. FETCH GOOGLE APPS SCRIPT
   
   PERUBAHAN PENTING:
   - Operasi TULIS (add/update/delete) TIDAK akan retry
   - Operasi BACA (get) BOLEH retry
   - Validasi "DM3 API ONLINE" untuk elak respons salah
========================================================================== */

/* Senarai operasi TULIS yang TIDAK boleh retry */
const DM3_WRITE_ACTIONS = [
    "addMember",
    "updateMember",
    "deleteMember",
    "addAJK",
    "updateAJK",
    "deleteAJK",
    "addProgram",
    "updateProgram",
    "deleteProgram",
    "addAttendance",
    "recordAttendance",
    "addAttendanceManual",
    "deleteAttendance",
    "addPortfolio",
    "updatePortfolio",
    "deletePortfolio",
    "saveSettings",
    "addData"
];

function isWriteAction(action) {
    return DM3_WRITE_ACTIONS.indexOf(String(action || "").trim()) !== -1;
}


async function fetchGoogleAPI(action, data, method) {
    data = data || {};
    method = method || "POST";

    const retries = API_CONFIG.queueMaxRetries || 2;
    const isWrite = isWriteAction(action);

    const url = String(API_CONFIG.googleAppsScriptUrl || "").trim();
    if (!url) {
        throw new Error("Google Apps Script URL belum dikonfigurasi.");
    }

    const normalizedMethod = String(method).toUpperCase() === "GET" ? "GET" : "POST";
    let requestURL = url;

    const options = {
        method: normalizedMethod,
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        cache: "no-store"
    };

    /* GET */
    if (normalizedMethod === "GET") {
        const params = new URLSearchParams();
        params.set("action", action);

        Object.keys(data || {}).forEach(function (key) {
            const value = data[key];
            if (value === undefined || value === null) return;

            params.set(
                key,
                typeof value === "object" ? JSON.stringify(value) : String(value)
            );
        });

        requestURL += (requestURL.includes("?") ? "&" : "?") + params.toString();
    }
    /* POST */
    else {
        options.body = JSON.stringify({
            action: action,
            data: data || {}
        });
    }

    let lastError = null;

    /* ==========================================================
       OPERASI TULIS — HANYA 1 PERCUBAAN (TIDAK RETRY)
       ========================================================== */
    if (isWrite) {

        try {
            let fetchPromise = fetch(requestURL, options);

            const response = await withTimeout(
                fetchPromise,
                API_CONFIG.timeout,
                action
            );

            /* HTTP 404 pada operasi TULIS — anggap berjaya */
            if (response.status === 404) {
                console.warn(
                    "[DM3 API V5.0] HTTP 404 pada " + action +
                    " (operasi tulis) — TIDAK retry untuk elak duplikat."
                );

                return {
                    success: true,
                    message: "Rekod berkemungkinan besar telah disimpan.",
                    data: null,
                    _warning: "HTTP 404 pada operasi tulis. Tidak retry."
                };
            }

            if (!response.ok) {
                const httpError = new Error("HTTP Error " + response.status);
                API_STATE.connected = false;
                API_STATE.lastError = httpError;
                throw httpError;
            }

            const responseText = await response.text();

            let result;
            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                result = {
                    success: true,
                    data: responseText,
                    message: ""
                };
            }

            API_STATE.connected = true;
            API_STATE.lastError = null;

            if (API_CONFIG.debug) {
                console.log("[DM3 API V5.0] RESPONSE:", action, result);
            }

            return result;

        } catch (error) {

            API_STATE.connected = false;
            API_STATE.lastError = error;

            console.error("[DM3 API V5.0] REQUEST FAILED (TULIS):", action, error);

            throw error;
        }
    }

    /* ==========================================================
       OPERASI BACA — BOLEH RETRY
       ========================================================== */

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            let fetchPromise;

            try {
                fetchPromise = fetch(requestURL, options);
            } catch (error) {
                API_STATE.connected = false;
                API_STATE.lastError = error;
                throw error;
            }

            const response = await withTimeout(
                fetchPromise,
                API_CONFIG.timeout,
                action
            );

            /* HTTP CHECK */
            if (!response.ok) {
                const shouldRetry =
                    (response.status === 404 || response.status >= 500) &&
                    attempt < retries;

                if (shouldRetry) {
                    const delay = 1000 * (attempt + 1);

                    console.warn(
                        "[DM3 API V5.0] HTTP " +
                        response.status +
                        " pada " +
                        action +
                        " — cuba semula dalam " +
                        delay +
                        "ms (" +
                        (retries - attempt) +
                        " percubaan baki)"
                    );

                    await new Promise(function (r) {
                        setTimeout(r, delay);
                    });

                    continue;
                }

                const httpError = new Error("HTTP Error " + response.status);
                API_STATE.connected = false;
                API_STATE.lastError = httpError;
                throw httpError;
            }

            /* RESPONSE TEXT */
            const responseText = await response.text();

            /* PARSE JSON */
            let result;

            try {
                result = JSON.parse(responseText);
            } catch (parseError) {
                result = {
                    success: true,
                    data: responseText,
                    message: ""
                };
            }

            /* ==========================================================
               VALIDASI KHAS:
               Jika action BUKAN "ping" tetapi message "DM3 API ONLINE",
               bermakna respons ini dari proxy/cache yang salah.
               Retry untuk dapatkan respons sebenar.
               ========================================================== */
            if (
                action !== "ping" &&
                result &&
                result.message === "DM3 API ONLINE" &&
                attempt < retries
            ) {
                const delay = 1000 * (attempt + 1);

                console.warn(
                    "[DM3 API V5.0] Respons salah pada " + action +
                    " (message=ONLINE) — cuba semula dalam " +
                    delay + "ms (" + (retries - attempt) +
                    " percubaan baki)"
                );

                await new Promise(function (r) {
                    setTimeout(r, delay);
                });

                continue;
            }
            /* ========================================================== */

            API_STATE.connected = true;
            API_STATE.lastError = null;

            /* LOGIN SESSION */
            if (action === "login" && result && result.success === true) {
                try {
                    localStorage.setItem(
                        "DM3_AUTH_USER",
                        JSON.stringify(result.data || {})
                    );
                } catch (error) {
                    console.warn("[DM3 API V5.0] Gagal simpan session:", error);
                }
            }

            if (API_CONFIG.debug) {
                console.log("[DM3 API V5.0] RESPONSE:", action, result);
            }

            return result;

        } catch (error) {
            lastError = error;

            const errorMsg = String(error.message || "");
            const shouldRetry =
                attempt < retries &&
                (/timeout/i.test(errorMsg) ||
                    /network/i.test(errorMsg) ||
                    /Failed to fetch/i.test(errorMsg) ||
                    /Load failed/i.test(errorMsg) ||
                    /404/.test(errorMsg));

            if (shouldRetry) {
                const delay = 1000 * (attempt + 1);

                console.warn(
                    "[DM3 API V5.0] " +
                    action +
                    " gagal — cuba semula dalam " +
                    delay +
                    "ms (" +
                    (retries - attempt) +
                    " percubaan baki): " +
                    errorMsg
                );

                await new Promise(function (r) {
                    setTimeout(r, delay);
                });

                continue;
            }

            API_STATE.connected = false;
            API_STATE.lastError = error;

            console.error("[DM3 API V5.0] REQUEST FAILED:", action, error);

            throw error;
        }
    }

    throw lastError || new Error("Request gagal selepas " + retries + " percubaan.");
}


/* ==========================================================================
   13. WITH TIMEOUT
========================================================================== */

function withTimeout(promise, milliseconds, action) {
    let timer = null;

    const timeoutPromise = new Promise(function (resolve, reject) {
        timer = setTimeout(function () {
            reject(
                new Error(
                    action + " timeout selepas " + (milliseconds / 1000) + " saat."
                )
            );
        }, milliseconds);
    });

    return Promise.race([promise, timeoutPromise]).finally(function () {
        if (timer) clearTimeout(timer);
    });
}


/* ==========================================================================
   14. LOCAL API REQUEST
========================================================================== */

async function localAPIRequest(action, data) {
    data = data || {};

    await apiDelay(50);

    switch (action) {

        case "ping":
            return {
                success: true,
                mode: "LOCAL",
                message: "DM3 LOCAL API ONLINE",
                data: {
                    app: "DM3 Management System",
                    status: "online",
                    timestamp: new Date().toISOString()
                }
            };

        case "login":
            return localLoginDM3(data);

        case "getMembers":
            return {
                success: true,
                message: "Data ahli berjaya diambil.",
                data: getLocalData("members")
            };

        case "getAJK":
            return {
                success: true,
                message: "Data AJK berjaya diambil.",
                data: getLocalData("ajk")
            };

        case "getPortfolio":
            return {
                success: true,
                data: getLocalData("portfolio")
            };

        case "getPrograms":
            return {
                success: true,
                data: getLocalData("programs")
            };

        case "getAttendance":
            return {
                success: true,
                data: getLocalData("attendance")
            };

        case "getSettings":
            return {
                success: true,
                data: getLocalData("settings")
            };

        case "getDashboard":
            return {
                success: true,
                data: generateDashboardData()
            };

        case "saveSettings":
            saveLocalData("settings", data);
            return {
                success: true,
                message: "Settings berjaya disimpan.",
                data: data
            };

        default:
            return {
                success: false,
                data: null,
                message: "Unknown API action: " + action
            };
    }
}


function localLoginDM3(data) {
    data = data || {};

    const username = String(data.username || "").trim();
    const password = String(data.password || "");

    if (username !== "admin" || password !== "admin123") {
        return {
            success: false,
            message: "Username atau password salah.",
            data: null
        };
    }

    return {
        success: true,
        message: "Login berjaya.",
        data: {
            id: 1,
            username: "admin",
            nama: "Pentadbir Utama DM3",
            role: "Admin",
            status: "Aktif",
            loginAt: new Date().toISOString()
        }
    };
}


/* ==========================================================================
   15. LOCAL DATA HELPERS
========================================================================== */

function getLocalData(type) {
    const storageKey = API_STORAGE[type];
    if (!storageKey) return [];

    const raw = localStorage.getItem(storageKey);
    if (!raw) {
        return Array.isArray(DEFAULT_DATA[type]) ? [] : {};
    }

    try {
        return JSON.parse(raw);
    } catch (error) {
        console.error("[DM3 API] LocalStorage parse error:", error);
        return Array.isArray(DEFAULT_DATA[type]) ? [] : {};
    }
}

function saveLocalData(type, data) {
    const storageKey = API_STORAGE[type];
    if (!storageKey) return false;

    try {
        localStorage.setItem(storageKey, JSON.stringify(data));
        return true;
    } catch (error) {
        console.error("[DM3 API] LocalStorage save error:", error);
        return false;
    }
}


/* ==========================================================================
   16. UTILITIES
========================================================================== */

function apiLog() {
    if (API_CONFIG.debug) {
        const args = Array.prototype.slice.call(arguments);
        console.log.apply(console, ["[DM3 API V5.0]"].concat(args));
    }
}

function apiWarn() {
    if (API_CONFIG.debug) {
        const args = Array.prototype.slice.call(arguments);
        console.warn.apply(console, ["[DM3 API V5.0]"].concat(args));
    }
}

function apiError() {
    const args = Array.prototype.slice.call(arguments);
    console.error.apply(console, ["[DM3 API V5.0]"].concat(args));
}

function apiDelay(milliseconds) {
    return new Promise(function (resolve) {
        setTimeout(resolve, milliseconds);
    });
}

function generateAPIId(prefix) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return String(prefix || "DM3") + "-" + timestamp + "-" + random;
}

function cleanValue(value) {
    if (value === undefined || value === null) return "";
    return String(value).trim();
}

function getTodayDate() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + day;
}

function getCurrentTime() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    const s = String(d.getSeconds()).padStart(2, "0");
    return h + ":" + m + ":" + s;
}


/* ==========================================================================
   17. PENDING SYNC
========================================================================== */

function getSyncQueue() {
    return getLocalData("syncQueue") || [];
}

function updatePendingSyncCount() {
    const queue = getSyncQueue();
    API_STATE.pendingSync = Array.isArray(queue) ? queue.length : 0;

    const badge = document.getElementById("pendingSyncBadge");
    if (badge) {
        badge.textContent = API_STATE.pendingSync;
        badge.style.display = API_STATE.pendingSync > 0 ? "inline-flex" : "none";
    }
}


/* ==========================================================================
   18. GENERATE DASHBOARD DATA (LOCAL)
========================================================================== */

function generateDashboardData() {
    const members = getLocalData("members") || [];
    const ajk = getLocalData("ajk") || [];
    const programs = getLocalData("programs") || [];
    const attendance = getLocalData("attendance") || [];

    return {
        totalMembers: members.length,
        totalAJK: ajk.length,
        totalPrograms: programs.length,
        totalAttendance: attendance.length,
        lastUpdated: new Date().toISOString()
    };
}


/* ==========================================================================
   19. API STATUS
========================================================================== */

function getAPIStatus() {
    return {
        mode: API_CONFIG.mode,
        connected: API_STATE.connected,
        pendingSync: API_STATE.pendingSync,
        lastSync: API_STATE.lastSync,
        lastError: API_STATE.lastError,
        activeRequests: DM3_REQUESTS.size,
        queuePending: API_QUEUE.length,
        queueRunning: API_QUEUE_RUNNING,
        queueDelay: API_CONFIG.queueDelay,
        googleAppsScriptConfigured: !!API_CONFIG.googleAppsScriptUrl
    };
}

window.getAPIStatus = getAPIStatus;


/* ==========================================================================
   20. PUBLIC API OBJECT
========================================================================== */

const DM3API = {
    config: API_CONFIG,
    state: API_STATE,
    request: apiRequest,
    status: getAPIStatus,
    queueStatus: window.__DM3_QUEUE_STATUS
};

window.DM3API = DM3API;
window.DM3_API = DM3API;


/* ==========================================================================
   21. INIT ON DOM READY
========================================================================== */

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAPI);
} else {
    initializeAPI();
}

/* ==========================================================================
   TOKEN STORAGE HELPER
========================================================================== */

function getStoredDM3Token() {
    try {
        const raw = localStorage.getItem("DM3_AUTH_USER");
        if (!raw) return "";

        const user = JSON.parse(raw);

        if (!user || !user.token) return "";

        // Semak tamat tempoh
        if (user.tokenExpires && user.tokenExpires < Date.now()) {
            console.warn("[DM3 TOKEN] Token sudah tamat tempoh.");
            localStorage.removeItem("DM3_AUTH_USER");
            return "";
        }

        return user.token;

    } catch (error) {
        console.warn("[DM3 TOKEN] Error:", error);
        return "";
    }
}

window.getStoredDM3Token = getStoredDM3Token;

/* ==========================================================================
   END API.JS V5.0 QUEUE EDITION
========================================================================== */