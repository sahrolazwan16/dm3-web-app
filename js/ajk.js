/* ============================================================
   DM3 MANAGEMENT SYSTEM
   AJK.JS V4.7 AUTO RENDER + IMAGE + SORT + TABLE ALIGN
   Persatuan Penduduk Desa Mentari 3

   SISTEM:
   - AJK diambil daripada AHLI
   - Tidak perlu daftar ahli semula
   - Modal dicipta oleh JS
   - Auto render apabila masuk menu AJK
   - Edit / Buang terus tersedia
   - Auto refresh selepas tambah/edit/buang
   - Upload gambar AJK + preview
   - Convert Google Drive URL untuk preview
   - Compatible dengan DM3_STATE.members
   - Compatible dengan API getAJK
   - Compatible dengan addAJK
   - Compatible dengan updateAJK
   - Compatible dengan deleteAJK
============================================================ */

(function () {

  "use strict";

  console.log("========================================");
  console.log("DM3 AJK.JS V4.7 AUTO RENDER + IMAGE + SORT + TABLE ALIGN");
  console.log("========================================");


  /* ==========================================================
     CONFIG
  ========================================================== */

  const AJK_CONFIG = {

    modalId: "ajk-modal",

    formId: "ajk-form",

    tableBodyId: "ajkTableBody",

    addButtonId: "add-ajk-btn",

    refreshButtonId: "ajk-refresh-btn",

    pageId: "page-ajk",

    defaultSession: "2025/2027",

    defaultStatus: "Aktif",

    imageMaxWidth: 600,

    imageMaxHeight: 600,

    imageQuality: 0.75,

    imageMaxBytes: 450000

  };


  /* ==========================================================
     STATE
  ========================================================== */

  const AJK_STATE = {

    data: [],

    initialized: false,

    editingId: null,

    imageData: "",

    imageName: "",

    observer: null,

    renderTimer: null,

    loadingPromise: null,

    pageWasVisible: false

  };


  /* ==========================================================
     HELPERS
  ========================================================== */

  function $(id) {

    return document.getElementById(id);

  }


  function escapeHTML(value) {

    if (
      value === null ||
      value === undefined
    ) {

      return "";

    }

    return String(value)

      .replace(/&/g, "&amp;")

      .replace(/</g, "&lt;")

      .replace(/>/g, "&gt;")

      .replace(/"/g, "&quot;")

      .replace(/'/g, "&#039;");

  }


  function valueOf(obj, keys) {

    if (!obj) {

      return "";

    }


    for (const key of keys) {

      if (

        Object.prototype.hasOwnProperty.call(
          obj,
          key
        ) &&

        obj[key] !== null &&

        obj[key] !== undefined

      ) {

        return obj[key];

      }

    }


    return "";

  }


  function showToast(
    message,
    type = "info"
  ) {

    if (
      typeof window.showToast ===
      "function"
    ) {

      window.showToast(
        message,
        type
      );

      return;

    }


    const container =
      $("toastContainer");


    if (!container) {

      console.log(
        "[DM3 AJK]",
        message
      );

      return;

    }


    const toast =
      document.createElement("div");


    toast.className =
      "toast";


    toast.textContent =
      message;


    container.appendChild(
      toast
    );


    setTimeout(
      function () {

        toast.remove();

      },
      3000
    );

  }


  function showLoading(message) {

    if (
      typeof window.showLoading ===
      "function"
    ) {

      window.showLoading(
        message ||
        "Sedang memproses..."
      );

      return;

    }


    const overlay =
      $("loadingOverlay");


    const text =
      $("loadingText");


    if (overlay) {

      overlay.classList.remove(
        "hidden"
      );

    }


    if (text) {

      text.textContent =
        message ||
        "Sedang memproses...";

    }

  }


  function hideLoading() {

    if (
      typeof window.hideLoading ===
      "function"
    ) {

      window.hideLoading();

      return;

    }


    const overlay =
      $("loadingOverlay");


    if (overlay) {

      overlay.classList.add(
        "hidden"
      );

    }

  }


  /* ==========================================================
     API
  ========================================================== */

  async function apiRequest(
    action,
    data = {}
  ) {

    console.log(
      "[DM3 AJK] API REQUEST:",
      action,
      data
    );


    if (
      typeof window.dm3ApiRequest ===
      "function"
    ) {

      return await window.dm3ApiRequest(
        action,
        data
      );

    }


    if (
      typeof window.apiRequest ===
      "function"
    ) {

      return await window.apiRequest(
        action,
        data
      );

    }


    if (
      typeof window.apiCall ===
      "function"
    ) {

      return await window.apiCall(
        action,
        data
      );

    }


    if (
      window.DM3_API &&
      typeof window.DM3_API.request ===
      "function"
    ) {

      return await window.DM3_API.request(
        action,
        data
      );

    }


    throw new Error(
      "API DM3 tidak dijumpai."
    );

  }


  /* ==========================================================
     GET MEMBERS
  ========================================================== */

  function getMembersFromState() {

    if (
      window.DM3_STATE &&
      Array.isArray(
        window.DM3_STATE.members
      )
    ) {

      return window.DM3_STATE.members;

    }


    return [];

  }


  /* ==========================================================
     MEMBER NORMALIZER
  ========================================================== */

  function normalizeMember(
    member
  ) {

    return {

      id: valueOf(
        member,
        [
          "id",
          "ID",
          "ahliId"
        ]
      ),

      nama: valueOf(
        member,
        [
          "nama",
          "Nama",
          "name"
        ]
      ),

      uidRfid: valueOf(
        member,
        [
          "uidRfid",
          "UID RFID",
          "uid",
          "UID"
        ]
      ),

      noRumah: valueOf(
        member,
        [
          "noRumah",
          "No Rumah",
          "No. Rumah",
          "no_rumah"
        ]
      ),

      telefon: valueOf(
        member,
        [
          "telepon",
          "Telefon",
          "phone"
        ]
      ),

      jawatan: valueOf(
        member,
        [
          "jawatan",
          "Jawatan"
        ]
      ),

      status: valueOf(
        member,
        [
          "status",
          "Status"
        ]
      ) || "Aktif",

      portfolio: valueOf(
        member,
        [
          "portfolio",
          "Portfolio"
        ]
      ),

      email: valueOf(
        member,
        [
          "email",
          "Email"
        ]
      ),

      sesi: valueOf(
        member,
        [
          "sesi",
          "Sesi"
        ]
      ),

      gambar: valueOf(
        member,
        [
          "gambar",
          "Gambar",
          "image",
          "Image",
          "gambarUrl",
          "imageUrl"
        ]
      )

    };

  }


  /* ==========================================================
     AJK FILTER + SORT + FALLBACK
  ========================================================== */

  function normalizePosition(value) {

    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  }


  function isAJKPosition(jawatan) {

    const p =
      normalizePosition(jawatan);


    if (
      !p ||
      p === "ahli"
    ) {

      return false;

    }


    return (

      p.includes("pengerusi") ||

      p.includes("setiausaha") ||

      p.includes("bendahari") ||

      p.includes("juru audit") ||

      p.includes("juruaudit") ||

      p.includes("juru-audit") ||

      p.includes("ajk") ||

      p.includes("ahli jawatankuasa") ||

      p.includes("naib pengerusi") ||

      p.includes("naib setiausaha") ||

      p.includes("naib bendahari") ||

      p.includes("ketua program")

    );

  }


  function ajkPositionPriority(jawatan) {

    const p =
      normalizePosition(jawatan);


    if (
      p.includes("pengerusi") &&
      !p.includes("naib") &&
      !p.includes("timbalan")
    ) {

      return 10;

    }


    if (
      p.includes("timbalan pengerusi")
    ) {

      return 20;

    }


    if (
      p.includes("naib pengerusi")
    ) {

      return 30;

    }


    if (
      p.includes("setiausaha") &&
      !p.includes("naib")
    ) {

      return 40;

    }


    if (
      p.includes("naib setiausaha")
    ) {

      return 50;

    }


    if (
      p.includes("bendahari") &&
      !p.includes("naib")
    ) {

      return 60;

    }


    if (
      p.includes("naib bendahari")
    ) {

      return 70;

    }


    if (
      p === "ajk" ||
      p.includes("ahli jawatankuasa") ||
      p.includes("ajk ") ||
      p.endsWith(" ajk")
    ) {

      return 80;

    }


    if (
      p.includes("ketua program")
    ) {

      return 85;

    }


    if (
      p.includes("juru audit") ||
      p.includes("juruaudit") ||
      p.includes("juru-audit")
    ) {

      return 90;

    }


    return 999;

  }


  function sortAJKData(data) {

    if (
      !Array.isArray(data)
    ) {

      return [];

    }


    return data
      .slice()
      .sort(
        function (a, b) {

          const pa =
            ajkPositionPriority(
              valueOf(
                a,
                [
                  "jawatan",
                  "Jawatan"
                ]
              )
            );


          const pb =
            ajkPositionPriority(
              valueOf(
                b,
                [
                  "jawatan",
                  "Jawatan"
                ]
              )
            );


          if (
            pa !== pb
          ) {

            return pa - pb;

          }


          const na =
            String(
              valueOf(
                a,
                [
                  "nama",
                  "Nama"
                ]
              ) || ""
            ).toLowerCase();


          const nb =
            String(
              valueOf(
                b,
                [
                  "nama",
                  "Nama"
                ]
              ) || ""
            ).toLowerCase();


          return na.localeCompare(
            nb,
            "ms"
          );

        }
      );

  }


  function buildAJKFromMembers() {

    const members =
      getMembersFromState();


    if (
      !members.length
    ) {

      return [];

    }


    return members

      .map(
        normalizeMember
      )

      .filter(
        function (member) {

          return isAJKPosition(
            member.jawatan
          );

        }
      )

      .map(
        function (member) {

          return {

            id:
              member.id,

            ahliId:
              member.id,

            memberId:
              member.id,

            uidRfid:
              member.uidRfid,

            nama:
              member.nama,

            jawatan:
              member.jawatan,

            portfolio:
              member.portfolio || "",

            telepon:
              member.telefon,

            email:
              member.email || "",

            status:
              member.status || "Aktif",

            sesi:
              member.sesi ||
              AJK_CONFIG.defaultSession,

            noRumah:
              member.noRumah,

            gambar:
              member.gambar || "",

            image:
              member.gambar || "",

            gambarNama:
              ""

          };

        }
      );

  }


  /* ==========================================================
     TABLE STYLE
  ========================================================== */

  function ensureAJKTableStyles() {

    if (
      document.getElementById(
        "dm3-ajk-v46-table-style"
      )
    ) {

      return;

    }


    const style =
      document.createElement(
        "style"
      );


    style.id =
      "dm3-ajk-v46-table-style";


    style.textContent = `

      #page-ajk .ajk-table,
      #page-ajk table {

        width: 100%;

        table-layout: fixed;

      }


      #page-ajk table th:nth-child(1),
      #page-ajk table td:nth-child(1) {

        width: 5%;

      }


      #page-ajk table th:nth-child(2),
      #page-ajk table td:nth-child(2) {

        width: 25%;

      }


      #page-ajk table th:nth-child(3),
      #page-ajk table td:nth-child(3) {

        width: 19%;

      }


      #page-ajk table th:nth-child(4),
      #page-ajk table td:nth-child(4) {

        width: 13%;

      }


      #page-ajk table th:nth-child(5),
      #page-ajk table td:nth-child(5) {

        width: 16%;

      }


      #page-ajk table th:nth-child(6),
      #page-ajk table td:nth-child(6) {

        width: 12%;

      }


      #page-ajk table th:nth-child(7),
      #page-ajk table td:nth-child(7) {

        width: 10%;

      }


      #page-ajk table th,
      #page-ajk table td {

        vertical-align: middle;

      }


      #page-ajk .ajk-rfid {

        display: block;

        width: 100%;

        min-width: 150px;

        white-space: normal;

        overflow-wrap: anywhere;

        word-break: break-word;

        font-weight: 600;

        font-family:
          ui-monospace,
          SFMono-Regular,
          Menlo,
          Monaco,
          Consolas,
          monospace;

        font-size: 13px;

        line-height: 1.4;

      }


      #page-ajk .ajk-name {

        white-space: normal;

        overflow-wrap: anywhere;

      }


      #page-ajk .ajk-actions {

        display: flex;

        align-items: center;

        justify-content: center;

        gap: 6px;

      }

    `;


    document.head.appendChild(
      style
    );

  }


  /* ==========================================================
     IMAGE HELPERS
  ========================================================== */

  function getImageValue(item) {

    return valueOf(
      item,
      [
        "gambar",
        "Gambar",
        "image",
        "Image",
        "gambarUrl",
        "imageUrl",
        "photo",
        "foto"
      ]
    );

  }


  /* ==========================================================
     CONVERT GOOGLE DRIVE URL
     Tukar URL lama ke format thumbnail yang boleh preview.
  ========================================================== */

  function convertDriveUrl(url) {

    if (!url) return "";

    let s = String(url).trim();

    // Kalau bukan URL Google Drive, pulangkan terus
    if (s.indexOf("drive.google.com") === -1 &&
        s.indexOf("googleusercontent.com") === -1) {
      return s;
    }

    // Extract file ID dari pelbagai format URL
    let fileId = "";

    // Format: ?id=FILE_ID
    let m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m) fileId = m[1];

    // Format: /d/FILE_ID/
    if (!fileId) {
      m = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (m) fileId = m[1];
    }

    // Format: /file/d/FILE_ID/
    if (!fileId) {
      m = s.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (m) fileId = m[1];
    }

    if (fileId) {
      // Guna thumbnail format yang boleh preview
      return "https://drive.google.com/thumbnail?id=" +
             fileId + "&sz=w1000";
    }

    return s;

  }


  function resetImageState() {

    AJK_STATE.imageData =
      "";

    AJK_STATE.imageName =
      "";

  }


  function renderImagePreview(
    imageData = "",
    imageName = ""
  ) {

    const preview =
      $("ajk-image-preview");


    const placeholder =
      $("ajk-image-placeholder");


    const removeButton =
      $("ajk-remove-image-btn");


    const nameLabel =
      $("ajk-image-name");


    if (!preview) {

      return;

    }


    if (imageData) {

      // ==========================================================
      // PEMBETULAN: Convert Google Drive URL untuk preview
      // ==========================================================
      preview.src =
        convertDriveUrl(imageData);
      // ==========================================================


      preview.style.display =
        "block";


      if (placeholder) {

        placeholder.style.display =
          "none";

      }


      if (removeButton) {

        removeButton.style.display =
          "inline-flex";

      }


      if (nameLabel) {

        nameLabel.textContent =
          imageName ||
          "Gambar dipilih";

      }

    } else {

      preview.removeAttribute(
        "src"
      );


      preview.style.display =
        "none";


      if (placeholder) {

        placeholder.style.display =
          "flex";

      }


      if (removeButton) {

        removeButton.style.display =
          "none";

      }


      if (nameLabel) {

        nameLabel.textContent =
          "Tiada gambar dipilih";

      }

    }

  }


  function compressImage(
    file
  ) {

    return new Promise(
      function (
        resolve,
        reject
      ) {

        if (!file) {

          reject(
            new Error(
              "Fail gambar tidak dijumpai."
            )
          );

          return;

        }


        if (
          !file.type ||
          !file.type.startsWith(
            "image/"
          )
        ) {

          reject(
            new Error(
              "Sila pilih fail gambar yang sah."
            )
          );

          return;

        }


        const reader =
          new FileReader();


        reader.onload =
          function (event) {

            const image =
              new Image();


            image.onload =
              function () {

                let width =
                  image.width;


                let height =
                  image.height;


                const maxWidth =
                  AJK_CONFIG.imageMaxWidth;


                const maxHeight =
                  AJK_CONFIG.imageMaxHeight;


                const ratio =
                  Math.min(

                    maxWidth /
                      width,

                    maxHeight /
                      height,

                    1

                  );


                width =
                  Math.round(
                    width * ratio
                  );


                height =
                  Math.round(
                    height * ratio
                  );


                const canvas =
                  document.createElement(
                    "canvas"
                  );


                canvas.width =
                  width;


                canvas.height =
                  height;


                const ctx =
                  canvas.getContext(
                    "2d"
                  );


                ctx.drawImage(
                  image,
                  0,
                  0,
                  width,
                  height
                );


                let dataUrl =
                  canvas.toDataURL(
                    "image/jpeg",
                    AJK_CONFIG.imageQuality
                  );


                /*
                  Cuba kecilkan lagi jika
                  data terlalu besar.
                */

                if (
                  dataUrl.length >
                  AJK_CONFIG.imageMaxBytes
                ) {

                  dataUrl =
                    canvas.toDataURL(
                      "image/jpeg",
                      0.55
                    );

                }


                resolve({

                  data:
                    dataUrl,

                  name:
                    file.name

                });

              };


            image.onerror =
              function () {

                reject(
                  new Error(
                    "Gagal membaca gambar."
                  )
                );

              };


            image.src =
              event.target.result;

          };


        reader.onerror =
          function () {

            reject(
              new Error(
                "Gagal membaca fail gambar."
              )
            );

          };


        reader.readAsDataURL(
          file
        );

      }
    );

  }


  async function handleImageChange(
    event
  ) {

    const input =
      event.target;


    if (
      !input ||
      !input.files ||
      !input.files.length
    ) {

      return;

    }


    const file =
      input.files[0];


    try {

      showToast(
        "Memproses gambar...",
        "info"
      );


      const result =
        await compressImage(
          file
        );


      AJK_STATE.imageData =
        result.data;


      AJK_STATE.imageName =
        result.name;


      renderImagePreview(
        result.data,
        result.name
      );


      console.log(
        "[DM3 AJK] IMAGE READY:",
        result.name,
        result.data.length
      );


    } catch (error) {

      console.error(
        "[DM3 AJK] IMAGE ERROR:",
        error
      );


      input.value =
        "";


      resetImageState();


      renderImagePreview();


      showToast(
        error.message ||
        "Gagal memproses gambar.",
        "error"
      );

    }

  }


  function removeImage() {

    const input =
      $("ajk-image");


    if (input) {

      input.value =
        "";

    }


    resetImageState();


    renderImagePreview();


    console.log(
      "[DM3 AJK] IMAGE REMOVED"
    );

  }


  /* ==========================================================
     CREATE MODAL
  ========================================================== */

  function ensureAJKModal() {

    let modal =
      $(AJK_CONFIG.modalId);


    if (modal) {

      console.log(
        "[DM3 AJK] Modal #ajk-modal sudah wujud."
      );

      return modal;

    }


    console.log(
      "[DM3 AJK] Modal tidak wujud. Mencipta modal baru..."
    );


    modal =
      document.createElement(
        "div"
      );


    modal.id =
      AJK_CONFIG.modalId;


    modal.className =
      "modal hidden";


    modal.innerHTML = `

      <div
        class="modal-overlay"
        data-ajk-close="true">
      </div>


      <div
        class="modal-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ajk-modal-title">


        <div class="modal-header">

          <div>

            <h3 id="ajk-modal-title">
              Tambah AJK
            </h3>

            <p>
              Pilih nama daripada senarai Ahli Persatuan.
            </p>

          </div>


          <button
            type="button"
            class="modal-close"
            id="ajk-modal-close"
            aria-label="Tutup">

            &times;

          </button>

        </div>


        <form
          id="ajk-form"
          class="ajk-modal-form"
          autocomplete="off">


          <input
            type="hidden"
            id="ajk-id"
            name="id">


          <div class="ajk-form-grid">


            <!-- AHLI -->

            <div class="ajk-form-group full">

              <label for="ajk-member-id">

                Pilih Ahli

                <span>*</span>

              </label>


              <select
                id="ajk-member-id"
                name="memberId"
                required>

                <option value="">
                  -- Pilih Ahli --
                </option>

              </select>

            </div>


            <!-- GAMBAR -->

            <div class="ajk-form-group full">

              <label>
                Gambar AJK
              </label>


              <div
                id="ajk-image-box"
                class="ajk-image-box">


                <div
                  id="ajk-image-placeholder"
                  class="ajk-image-placeholder">

                  <i class="fa-solid fa-camera"></i>

                  <span>
                    Tiada gambar dipilih
                  </span>

                  <small>
                    Pilih gambar AJK
                  </small>

                </div>


                <img
                  id="ajk-image-preview"
                  class="ajk-image-preview"
                  alt="Preview gambar AJK"
                  style="display:none;">


              </div>


              <div
                class="ajk-image-controls">


                <label
                  for="ajk-image"
                  class="secondary-button ajk-image-select-btn">

                  <i class="fa-solid fa-image"></i>

                  Pilih Gambar

                </label>


                <input
                  type="file"
                  id="ajk-image"
                  name="gambar"
                  accept="image/*"
                  style="display:none;">


                <button
                  type="button"
                  id="ajk-remove-image-btn"
                  class="secondary-button"
                  style="display:none;">

                  <i class="fa-solid fa-trash"></i>

                  Buang Gambar

                </button>


              </div>


              <div
                id="ajk-image-name"
                class="ajk-image-name">

                Tiada gambar dipilih

              </div>

            </div>


            <!-- JAWATAN -->

            <div class="ajk-form-group">

              <label for="ajk-position">

                Jawatan

                <span>*</span>

              </label>


              <input
                id="ajk-position"
                name="jawatan"
                type="text"
                placeholder="Contoh: Pengerusi"
                required>

            </div>


            <!-- PORTFOLIO -->

            <div class="ajk-form-group">

              <label for="ajk-portfolio">

                Portfolio

              </label>


              <input
                id="ajk-portfolio"
                name="portfolio"
                type="text"
                placeholder="Contoh: Ketua Program">

            </div>


            <!-- SESI -->

            <div class="ajk-form-group">

              <label for="ajk-session">

                Sesi

              </label>


              <input
                id="ajk-session"
                name="sesi"
                type="text"
                value="${AJK_CONFIG.defaultSession}">

            </div>


            <!-- STATUS -->

            <div class="ajk-form-group">

              <label for="ajk-status">

                Status

              </label>


              <select
                id="ajk-status"
                name="status">

                <option value="Aktif">
                  Aktif
                </option>

                <option value="Tidak Aktif">
                  Tidak Aktif
                </option>

              </select>

            </div>


          </div>


          <div class="modal-footer">


            <button
              type="button"
              class="secondary-button"
              id="ajk-cancel-btn">

              Batal

            </button>


            <button
              type="submit"
              class="primary-button"
              id="ajk-save-btn">

              <i class="fa-solid fa-floppy-disk"></i>

              Simpan AJK

            </button>


          </div>


        </form>


      </div>

    `;


    document.body.appendChild(
      modal
    );


    bindModalEvents();


    console.log(
      "[DM3 AJK] Modal #ajk-modal berjaya dicipta."
    );


    return modal;

  }


  /* ==========================================================
     MODAL EVENTS
  ========================================================== */

  function bindModalEvents() {

    const modal =
      $(AJK_CONFIG.modalId);


    if (!modal) {

      console.error(
        "[DM3 AJK] Gagal bind modal."
      );

      return;

    }


    const closeButton =
      $("ajk-modal-close");


    const cancelButton =
      $("ajk-cancel-btn");


    const overlay =
      modal.querySelector(
        "[data-ajk-close='true']"
      );


    if (closeButton) {

      closeButton.onclick =
        closeAJKModal;

    }


    if (cancelButton) {

      cancelButton.onclick =
        closeAJKModal;

    }


    if (overlay) {

      overlay.onclick =
        closeAJKModal;

    }


    const imageInput =
      $("ajk-image");


    if (imageInput) {

      imageInput.addEventListener(
        "change",
        handleImageChange
      );

    }


    const removeImageButton =
      $("ajk-remove-image-btn");


    if (removeImageButton) {

      removeImageButton.onclick =
        removeImage;

    }


    const form =
      $("ajk-form");


    if (form) {

      form.addEventListener(
        "submit",
        handleAJKSubmit
      );

    }


    /*
      Satu global keydown handler sahaja.
    */

    if (
      !window.__DM3_AJK_ESCAPE_BOUND
    ) {

      document.addEventListener(
        "keydown",
        function (event) {

          const currentModal =
            $(AJK_CONFIG.modalId);


          if (
            event.key === "Escape" &&
            currentModal &&
            !currentModal.classList.contains(
              "hidden"
            )
          ) {

            closeAJKModal();

          }

        }
      );


      window.__DM3_AJK_ESCAPE_BOUND =
        true;

    }

  }


  /* ==========================================================
     OPEN MODAL
  ========================================================== */

  function openAJKModal(
    id = null
  ) {

    console.log(
      "[DM3 AJK] OPEN MODAL:",
      id
    );


    const modal =
      ensureAJKModal();


    if (!modal) {

      console.error(
        "[DM3 AJK] Modal gagal diwujudkan."
      );

      return;

    }


    const form =
      $("ajk-form");


    const title =
      $("ajk-modal-title");


    const hiddenId =
      $("ajk-id");


    if (!form) {

      console.error(
        "[DM3 AJK] Form AJK tidak dijumpai."
      );

      return;

    }


    resetAJKForm();


    if (
      id !== null &&
      id !== undefined &&
      String(id) !== ""
    ) {

      const item =
        AJK_STATE.data.find(
          function (row) {

            return String(
              valueOf(
                row,
                [
                  "id",
                  "ID"
                ]
              )
            ) === String(id);

          }
        );


      if (!item) {

        showToast(
          "Rekod AJK tidak dijumpai.",
          "error"
        );

        return;

      }


      AJK_STATE.editingId =
        id;


      if (title) {

        title.textContent =
          "Kemaskini AJK";

      }


      if (hiddenId) {

        hiddenId.value =
          id;

      }


      // ==========================================
      // PEMBETULAN: Hantar ID dan Nama untuk padanan
      // ==========================================
      setMemberSelectValue(
        valueOf(
          item,
          [
            "ahliId",
            "memberId",
            "idAhli",
            "member_id"
          ]
        ),
        valueOf(
          item,
          [
            "nama",
            "Nama"
          ]
        )
      );
      // ==========================================


      const position =
        $("ajk-position");


      if (position) {

        position.value =
          valueOf(
            item,
            [
              "jawatan",
              "Jawatan"
            ]
          );

      }


      const portfolio =
        $("ajk-portfolio");


      if (portfolio) {

        portfolio.value =
          valueOf(
            item,
            [
              "portfolio",
              "Portfolio"
            ]
          );

      }


      const session =
        $("ajk-session");


      if (session) {

        session.value =
          valueOf(
            item,
            [
              "sesi",
              "Sesi"
            ]
          ) ||
          AJK_CONFIG.defaultSession;

      }


      const status =
        $("ajk-status");


      if (status) {

        status.value =
          valueOf(
            item,
            [
              "status",
              "Status"
            ]
          ) ||
          AJK_CONFIG.defaultStatus;

      }


      /*
        Gambar sedia ada.
      */

      const existingImage =
        getImageValue(item);


      if (existingImage) {

        AJK_STATE.imageData =
          String(existingImage);


        AJK_STATE.imageName =
          "Gambar sedia ada";


        renderImagePreview(
          AJK_STATE.imageData,
          AJK_STATE.imageName
        );

      }

    }


    modal.classList.remove(
      "hidden"
    );


    modal.style.display =
      "flex";


    document.body.style.overflow =
      "hidden";


    setTimeout(
      function () {

        const memberSelect =
          $("ajk-member-id");


        if (memberSelect) {

          memberSelect.focus();

        }

      },
      50
    );


    console.log(
      "[DM3 AJK] MODAL OPENED"
    );

  }


  /* ==========================================================
     CLOSE MODAL
  ========================================================== */

  function closeAJKModal() {

    const modal =
      $(AJK_CONFIG.modalId);


    if (!modal) {

      return;

    }


    modal.classList.add(
      "hidden"
    );


    modal.style.display =
      "none";


    document.body.style.overflow =
      "";


    AJK_STATE.editingId =
      null;


    resetAJKForm();


    console.log(
      "[DM3 AJK] MODAL CLOSED"
    );

  }


  /* ==========================================================
     RESET FORM
  ========================================================== */

  function resetAJKForm() {

    const form =
      $("ajk-form");


    if (!form) {

      return;

    }


    form.reset();


    AJK_STATE.editingId =
      null;


    resetImageState();


    const id =
      $("ajk-id");


    if (id) {

      id.value =
        "";

    }


    const title =
      $("ajk-modal-title");


    if (title) {

      title.textContent =
        "Tambah AJK";

    }


    const session =
      $("ajk-session");


    if (session) {

      session.value =
        AJK_CONFIG.defaultSession;

    }


    const status =
      $("ajk-status");


    if (status) {

      status.value =
        AJK_CONFIG.defaultStatus;

    }


    renderImagePreview();


    populateMemberSelect();

  }


  /* ==========================================================
     MEMBER SELECT
  ========================================================== */

  function populateMemberSelect(selectedId = null) {

    const select =
      $("ajk-member-id");


    if (!select) {

      return;

    }


    const members =
      getMembersFromState()

        .map(
          normalizeMember
        )

        .filter(
          function (member) {

            return (
              member.id &&
              member.nama
            );

          }
        );


    // Gunakan selectedId jika diberi, jika tidak simpan nilai semasa
    const currentValue =
      selectedId !== null ? selectedId : select.value;


    select.innerHTML = `

      <option value="">
        -- Pilih Ahli --
      </option>

    `;


    if (!members.length) {

      select.innerHTML += `

        <option
          value=""
          disabled>

          Tiada ahli tersedia

        </option>

      `;

      return;

    }


    members.forEach(
      function (member) {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          String(member.id);


        option.textContent =
          member.nama +

          (
            member.noRumah
              ? " — Rumah " +
                member.noRumah
              : ""
          );


        option.dataset.nama =
          member.nama;


        option.dataset.uid =
          member.uidRfid;


        option.dataset.noRumah =
          member.noRumah;


        select.appendChild(
          option
        );

      }
    );


    if (currentValue) {

      select.value =
        String(currentValue);

    }

  }


  function setMemberSelectValue(
    id,
    name = null
  ) {

    const select =
      $("ajk-member-id");


    if (!select) {

      return;

    }


    // Tentukan ID: Jika tiada ID, cari melalui Nama
    let finalId = id;

    if (!finalId && name) {

      const members = getMembersFromState().map(normalizeMember);

      const matchedMember = members.find(function(m) {

        return String(m.nama).toLowerCase().trim() === String(name).toLowerCase().trim();

      });

      if (matchedMember) {

        finalId = matchedMember.id;

      }

    }


    populateMemberSelect(finalId);


    if (
      finalId !== null &&
      finalId !== undefined
    ) {

      select.value =
        String(finalId);

    }

  }


  /* ==========================================================
     MEMBER SELECT CHANGE
  ========================================================== */

  function handleMemberChange() {

    const select =
      $("ajk-member-id");


    if (!select) {

      return;

    }


    const member =
      getMembersFromState()

        .map(
          normalizeMember
        )

        .find(
          function (item) {

            return (
              String(item.id) ===
              String(select.value)
            );

          }
        );


    if (!member) {

      return;

    }


    console.log(
      "[DM3 AJK] Ahli dipilih:",
      member
    );


    const position =
      $("ajk-position");


    if (
      position &&
      !position.value.trim() &&
      member.jawatan &&
      member.jawatan !== "Ahli"
    ) {

      position.value =
        member.jawatan;

    }

  }


  /* ==========================================================
     FORM SUBMIT
  ========================================================== */

  async function handleAJKSubmit(
    event
  ) {

    event.preventDefault();


    const memberSelect =
      $("ajk-member-id");


    const position =
      $("ajk-position");


    const portfolio =
      $("ajk-portfolio");


    const session =
      $("ajk-session");


    const status =
      $("ajk-status");


    const hiddenId =
      $("ajk-id");


    const memberId =
      memberSelect
        ? memberSelect.value.trim()
        : "";


    const jawatan =
      position
        ? position.value.trim()
        : "";


    if (!memberId) {

      showToast(
        "Sila pilih ahli.",
        "error"
      );


      if (memberSelect) {

        memberSelect.focus();

      }


      return;

    }


    if (!jawatan) {

      showToast(
        "Sila masukkan jawatan AJK.",
        "error"
      );


      if (position) {

        position.focus();

      }


      return;

    }


    const members =
      getMembersFromState()
        .map(normalizeMember);


    const member =
      members.find(
        function (item) {

          return (
            String(item.id) ===
            String(memberId)
          );

        }
      );


    if (!member) {

      showToast(
        "Ahli yang dipilih tidak dijumpai.",
        "error"
      );

      return;

    }


    /*
      PAYLOAD
    */

    const payload = {

      id:
        hiddenId
          ? hiddenId.value
          : "",


      ahliId:
        member.id,


      memberId:
        member.id,


      uidRfid:
        member.uidRfid,


      nama:
        member.nama,


      jawatan:
        jawatan,


      portfolio:
        portfolio
          ? portfolio.value.trim()
          : "",


      telepon:
        member.telefon,


      email:
        "",


      status:
        status
          ? status.value
          : AJK_CONFIG.defaultStatus,


      sesi:
        session
          ? session.value.trim()
          : AJK_CONFIG.defaultSession,


      noRumah:
        member.noRumah,


      /*
        GAMBAR
      */

      gambar:
        AJK_STATE.imageData || "",


      image:
        AJK_STATE.imageData || "",


      gambarNama:
        AJK_STATE.imageName || ""

    };


    console.log(
      "[DM3 AJK] SAVE PAYLOAD:",
      payload
    );


    const saveButton =
      $("ajk-save-btn");


    try {

      showLoading(

        AJK_STATE.editingId

          ? "Mengemaskini AJK..."

          : "Menyimpan AJK..."

      );


      if (saveButton) {

        saveButton.disabled =
          true;


        saveButton.classList.add(
          "ajk-saving"
        );

      }


      let response;


      if (
        AJK_STATE.editingId
      ) {

        response =
          await apiRequest(
            "updateAJK",
            payload
          );

      } else {

        response =
          await apiRequest(
            "addAJK",
            payload
          );

      }


      console.log(
        "[DM3 AJK] SAVE RESPONSE:",
        response
      );


      if (
        !response ||
        response.success !== true
      ) {

        throw new Error(

          response &&
          response.message

            ? response.message

            : "Gagal menyimpan AJK."

        );

      }


           showToast(
        response.message ||
        "AJK berjaya disimpan.",
        "success"
      );


      closeAJKModal();


      // ==========================================================
      // TAMBAH: Clear cache supaya data AJK fresh
      // ==========================================================
      if (typeof window.clearAPICache === "function") {
        window.clearAPICache();
      }
      // ==========================================================


      /*
        WAJIB:
        Ambil data terbaru daripada backend.
      */

      await loadAJK();

      /*
        Pastikan render terakhir.
      */

      renderAJK();


      updateGlobalState();


      /*
        Update counter dashboard
        jika fungsi tersedia.
      */

      if (
        typeof window.updateAllCounters ===
        "function"
      ) {

        window.updateAllCounters();

      }


    } catch (error) {

      console.error(
        "[DM3 AJK] SAVE ERROR:",
        error
      );


      showToast(
        error.message ||
        "Ralat menyimpan AJK.",
        "error"
      );

    } finally {

      hideLoading();


      if (saveButton) {

        saveButton.disabled =
          false;


        saveButton.classList.remove(
          "ajk-saving"
        );

      }

    }

  }


  /* ==========================================================
     LOAD AJK
  ========================================================== */

    async function loadAJK(
    options = {}
  ) {

    const silent =
      options &&
      options.silent === true;

    const forceRefresh =
      options &&
      options.forceRefresh === true;


    // ==========================================================
    // TAMBAH: Jika force refresh, clear cache dulu
    // ==========================================================
    if (forceRefresh && typeof window.clearAPICache === "function") {
      window.clearAPICache();
    }
    // ==========================================================


    if (
      AJK_STATE.loadingPromise
    ) {

      return AJK_STATE.loadingPromise;

    }


    console.log(
      "[DM3 AJK] Loading AJK..."
    );


    const request =
      (async function () {

        try {

          const response =
            await apiRequest(
              "getAJK",
              {}
            );


          console.log(
            "[DM3 AJK] GET AJK RESPONSE:",
            response
          );


          if (

            response &&

            response.success === true &&

            Array.isArray(
              response.data
            )

          ) {

            /*
              Jika backend mempunyai data AJK,
              guna data backend.

              Jika backend pulangkan array kosong,
              fallback kepada data AHLI.
            */

            AJK_STATE.data =

              response.data.length

                ? response.data

                : buildAJKFromMembers();

          } else {

            /*
              Backend response tidak sah.
              Cuba bina daripada AHLI.
            */

            AJK_STATE.data =
              buildAJKFromMembers();

          }


          /*
            Susun ikut hierarchy jawatan.
          */

          AJK_STATE.data =
            sortAJKData(
              AJK_STATE.data
            );


          updateGlobalState();


          renderAJK();


          populateMemberSelect();


          return AJK_STATE.data;


        } catch (error) {

          console.error(
            "[DM3 AJK] LOAD ERROR:",
            error
          );


          /*
            Jika API gagal,
            jangan kosongkan table.
            Guna data AHLI sebagai fallback.
          */

          AJK_STATE.data =
            sortAJKData(
              buildAJKFromMembers()
            );


          updateGlobalState();


          renderAJK();


          populateMemberSelect();


          if (!silent) {

            showToast(

              error.message ||

              "Gagal mendapatkan data AJK.",

              "error"

            );

          }


          return AJK_STATE.data;

        }

      })();


    AJK_STATE.loadingPromise =
      request;


    try {

      return await request;

    } finally {

      if (
        AJK_STATE.loadingPromise ===
        request
      ) {

        AJK_STATE.loadingPromise =
          null;

      }

    }

  }


  /* ==========================================================
     UPDATE GLOBAL STATE
  ========================================================== */

  function updateGlobalState() {

    if (
      window.DM3_STATE
    ) {

      window.DM3_STATE.ajk =

        Array.isArray(
          AJK_STATE.data
        )

          ? AJK_STATE.data

          : [];

    }

  }


  /* ==========================================================
     RENDER
  ========================================================== */

  function renderAJK() {

    const tbody =
      $(AJK_CONFIG.tableBodyId);


    if (!tbody) {

      console.warn(
        "[DM3 AJK] #ajkTableBody tidak dijumpai."
      );

      return;

    }


    /*
      Pastikan style table V4.6
      sentiasa wujud.
    */

    ensureAJKTableStyles();


    /*
      Pastikan data sentiasa disusun.
    */

    const data =
      sortAJKData(

        Array.isArray(
          AJK_STATE.data
        )

          ? AJK_STATE.data

          : []

      );


    AJK_STATE.data =
      data;


    /*
      Tiada data.
    */

    if (!data.length) {

      tbody.innerHTML = `

        <tr>

          <td
            colspan="7"
            class="ajk-empty">

            <i class="fa-solid fa-user-tie"></i>

            <strong>
              Tiada AJK
            </strong>

            <span>
              Klik "Tambah AJK"
              untuk melantik ahli sebagai AJK.
            </span>

          </td>

        </tr>

      `;


      return;

    }


    /*
      PAPARAN TABLE V4.6

      1. Bil
      2. Nama
      3. UID RFID
      4. No. Rumah
      5. Jawatan
      6. Status
      7. Tindakan
    */

    tbody.innerHTML =

      data.map(
        function (
          item,
          index
        ) {


          const id =
            valueOf(
              item,
              [
                "id",
                "ID"
              ]
            );


          const nama =
            valueOf(
              item,
              [
                "nama",
                "Nama",
                "name"
              ]
            ) || "-";


          /*
            UID RFID
          */

          const uidRfid =
            valueOf(
              item,
              [
                "uidRfid",
                "UID RFID",
                "uid",
                "UID",
                "rfid",
                "RFID"
              ]
            ) || "-";


          /*
            NO RUMAH
          */

          const noRumah =
            valueOf(
              item,
              [
                "noRumah",
                "No Rumah",
                "No. Rumah",
                "no_rumah"
              ]
            ) || "-";


          /*
            JAWATAN
          */

          const jawatan =
            valueOf(
              item,
              [
                "jawatan",
                "Jawatan"
              ]
            ) || "-";


          /*
            STATUS
          */

          const status =
            valueOf(
              item,
              [
                "status",
                "Status"
              ]
            ) || "Aktif";


          /*
            GAMBAR
          */

          const image =
            getImageValue(
              item
            );


          const active =

            String(status)
              .toLowerCase()
              .includes("aktif")

            &&

            !String(status)
              .toLowerCase()
              .includes("tidak");


          // ==========================================================
          // PEMBETULAN: Convert Google Drive URL untuk table
          // ==========================================================
          const imageHTML =

            image

              ? `

                <img
                  src="${escapeHTML(convertDriveUrl(image))}"
                  alt="${escapeHTML(nama)}"
                  class="ajk-table-photo"
                  loading="lazy">

              `

              : `

                <div
                  class="ajk-table-photo-placeholder">

                  <i class="fa-solid fa-user-tie"></i>

                </div>

              `;
          // ==========================================================


          return `

            <tr>


              <!-- ==================================================
                   1. BIL
              ================================================== -->

              <td>

                ${index + 1}

              </td>


              <!-- ==================================================
                   2. NAMA
              ================================================== -->

              <td>

                <div class="ajk-person-cell">

                  ${imageHTML}

                  <div>

                    <div class="ajk-name">

                      ${escapeHTML(nama)}

                    </div>

                  </div>

                </div>

              </td>


              <!-- ==================================================
                   3. UID RFID
              ================================================== -->

              <td>

                <div class="ajk-rfid">

                  ${escapeHTML(uidRfid)}

                </div>

              </td>


              <!-- ==================================================
                   4. NO RUMAH
              ================================================== -->

              <td>

                ${escapeHTML(noRumah)}

              </td>


              <!-- ==================================================
                   5. JAWATAN
              ================================================== -->

              <td>

                <div class="ajk-position">

                  ${escapeHTML(jawatan)}

                </div>

              </td>


              <!-- ==================================================
                   6. STATUS
              ================================================== -->

              <td>

                <span
                  class="ajk-status ${
                    active
                      ? "active"
                      : "inactive"
                  }">

                  <i
                    class="fa-solid ${
                      active
                        ? "fa-circle-check"
                        : "fa-circle-xmark"
                    }">
                  </i>

                  ${escapeHTML(status)}

                </span>

              </td>


              <!-- ==================================================
                   7. TINDAKAN
              ================================================== -->

              <td>

                <div class="ajk-actions">


                  <button
                    type="button"
                    class="ajk-action-btn ajk-edit-btn"
                    data-ajk-edit="${escapeHTML(id)}"
                    title="Kemaskini AJK"
                    aria-label="Kemaskini AJK">

                    <i class="fa-solid fa-pen"></i>

                  </button>


                  <button
                    type="button"
                    class="ajk-action-btn ajk-delete-btn"
                    data-ajk-delete="${escapeHTML(id)}"
                    title="Buang AJK"
                    aria-label="Buang AJK">

                    <i class="fa-solid fa-trash"></i>

                  </button>


                </div>

              </td>


            </tr>

          `;

        }

      ).join("");

  }


  /* ==========================================================
     TABLE EVENTS
  ========================================================== */

  function handleTableClick(
    event
  ) {

    const editButton =
      event.target.closest(
        "[data-ajk-edit]"
      );


    if (editButton) {

      const id =
        editButton.getAttribute(
          "data-ajk-edit"
        );


      console.log(
        "[DM3 AJK] EDIT CLICK:",
        id
      );


      openAJKModal(
        id
      );


      return;

    }


    const deleteButton =
      event.target.closest(
        "[data-ajk-delete]"
      );


    if (deleteButton) {

      const id =
        deleteButton.getAttribute(
          "data-ajk-delete"
        );


      console.log(
        "[DM3 AJK] DELETE CLICK:",
        id
      );


      deleteAJK(
        id
      );

    }

  }


  /* ==========================================================
     DELETE AJK
  ========================================================== */

  async function deleteAJK(
    id
  ) {

    if (!id) {

      return;

    }


    const item =
      AJK_STATE.data.find(
        function (row) {

          return String(
            valueOf(
              row,
              [
                "id",
                "ID"
              ]
            )
          ) === String(id);

        }
      );


    const nama =
      item

        ? valueOf(
            item,
            [
              "nama",
              "Nama"
            ]
          )

        : "";


    const confirmed =
      window.confirm(

        "Padam AJK" +

        (
          nama
            ? " " + nama
            : ""
        ) +

        "?\n\n" +

        "Rekod AJK akan dibuang."

      );


    if (!confirmed) {

      return;

    }


    try {

      showLoading(
        "Memadam AJK..."
      );


      const response =
        await apiRequest(
          "deleteAJK",
          {
            id: id
          }
        );


      console.log(
        "[DM3 AJK] DELETE RESPONSE:",
        response
      );


      if (
        !response ||
        response.success !== true
      ) {

        throw new Error(

          response &&
          response.message

            ? response.message

            : "Gagal memadam AJK."

        );

      }


            showToast(
        response.message ||
        "AJK berjaya dipadam.",
        "success"
      );


      // ==========================================================
      // TAMBAH: Clear cache supaya data AJK fresh
      // ==========================================================
      if (typeof window.clearAPICache === "function") {
        window.clearAPICache();
      }
      // ==========================================================


      await loadAJK();


      renderAJK();


      updateGlobalState();


      if (
        typeof window.updateAllCounters ===
        "function"
      ) {

        window.updateAllCounters();

      }


    } catch (error) {

      console.error(
        "[DM3 AJK] DELETE ERROR:",
        error
      );


      showToast(
        error.message ||
        "Ralat memadam AJK.",
        "error"
      );

    } finally {

      hideLoading();

    }

  }


  /* ==========================================================
     BIND BUTTONS
  ========================================================== */

  function bindButtons() {

    const addButton =
      $(AJK_CONFIG.addButtonId);


    if (addButton) {

      /*
        onclick digunakan supaya
        handler tidak berganda.
      */

      addButton.onclick =
        function (event) {

          event.preventDefault();


          console.log(
            "[DM3 AJK] ADD BUTTON CLICK"
          );


          openAJKModal();

        };


      console.log(
        "[DM3 AJK] ADD BUTTON READY"
      );

    } else {

      console.error(
        "[DM3 AJK] #add-ajk-btn tidak dijumpai."
      );

    }


    const refreshButton =
      $(AJK_CONFIG.refreshButtonId);


        if (refreshButton) {

      refreshButton.onclick =
        async function (event) {

          event.preventDefault();


          // Clear cache bila user klik Refresh manual
          if (typeof window.clearAPICache === "function") {
            window.clearAPICache();
          }


          await loadAJK();

        };


      console.log(
        "[DM3 AJK] REFRESH BUTTON READY"
      );

    }


    const tbody =
      $(AJK_CONFIG.tableBodyId);


    if (tbody) {

      /*
        Elakkan event listener berganda.
      */

      if (
        tbody.dataset.ajkEventsBound !==
        "true"
      ) {

        tbody.addEventListener(
          "click",
          handleTableClick
        );


        tbody.dataset.ajkEventsBound =
          "true";

      }

    }

  }


  /* ==========================================================
     AUTO RENDER WHEN AJK PAGE OPENS
  ========================================================== */

  function isAJKPageVisible() {

    const page =
      $(AJK_CONFIG.pageId);


    if (!page) {

      return false;

    }


    const style =
      window.getComputedStyle(
        page
      );


    return (

      page.classList.contains(
        "active"
      )

      ||

      style.display !==
        "none"

    );

  }


  function autoRenderAJK() {

    if (
      !AJK_STATE.initialized
    ) {

      return;

    }


    const tbody =
      $(AJK_CONFIG.tableBodyId);


    if (!tbody) {

      return;

    }


    const visible =
      isAJKPageVisible();


    /*
      Bila halaman tidak kelihatan,
      reset flag supaya apabila masuk
      semula ia dianggap page baru.
    */

    if (!visible) {

      AJK_STATE.pageWasVisible =
        false;

      return;

    }


    /*
      Tentukan sama ada baru masuk
      halaman AJK.
    */

    const pageJustOpened =
      !AJK_STATE.pageWasVisible;


    AJK_STATE.pageWasVisible =
      true;


    console.log(
      "[DM3 AJK] AUTO RENDER AJK PAGE"
    );


    /*
      Jika global state sudah mempunyai
      data AJK, guna data tersebut.

      Jika kosong, bina AJK daripada AHLI.
    */

    if (

      window.DM3_STATE &&

      Array.isArray(
        window.DM3_STATE.ajk
      ) &&

      window.DM3_STATE.ajk.length

    ) {

      AJK_STATE.data =
        window.DM3_STATE.ajk;

    } else {

      const derived =
        buildAJKFromMembers();


      if (
        derived.length
      ) {

        AJK_STATE.data =
          derived;

      }

    }


    /*
      Susunan tetap.
    */

    AJK_STATE.data =
      sortAJKData(
        AJK_STATE.data
      );


    renderAJK();


    updateGlobalState();


    populateMemberSelect();


    /*
      PENTING:
      Apabila baru masuk halaman AJK,
      terus ambil data backend secara automatik.

      Tidak perlu tekan Refresh.
    */

    if (
      pageJustOpened
    ) {

      loadAJK(
        {
          silent: true
        }
      )
        .catch(
          function (error) {

            console.error(
              "[DM3 AJK] AUTO LOAD ERROR:",
              error
            );

          }
        );

    }

  }


  /* ==========================================================
     AJK PAGE OBSERVER
  ========================================================== */

  function setupAJKObserver() {

    const page =
      $(AJK_CONFIG.pageId);


    if (!page) {

      console.warn(
        "[DM3 AJK] page-ajk belum dijumpai."
      );


      return;

    }


    if (
      AJK_STATE.observer
    ) {

      return;

    }


    AJK_STATE.observer =

      new MutationObserver(
        function () {

          clearTimeout(
            AJK_STATE.renderTimer
          );


          AJK_STATE.renderTimer =

            setTimeout(
              function () {

                autoRenderAJK();

              },
              30
            );

        }
      );


    AJK_STATE.observer.observe(

      page,

      {

        attributes: true,

        attributeFilter: [
          "class",
          "style"
        ]

      }

    );


    console.log(
      "[DM3 AJK] AUTO RENDER OBSERVER READY"
    );

  }


  /* ==========================================================
     MODULE INITIALIZE
  ========================================================== */

  function initAJK() {

    if (
      AJK_STATE.initialized
    ) {

      console.log(
        "[DM3 AJK] Already initialized."
      );


      /*
        Walaupun sudah initialize,
        pastikan render terbaru.
      */

      setTimeout(
        autoRenderAJK,
        50
      );


      return;

    }


    console.log(
      "========================================"
    );


    console.log(
      "DM3 AJK.JS V4.7 INITIALIZING"
    );


    console.log(
      "========================================"
    );


    /*
      Modal dicipta SEGERA.
    */

    ensureAJKModal();


    /*
      Style table V4.6.
    */

    ensureAJKTableStyles();


    /*
      Bind semua button.
    */

    bindButtons();


    /*
      Bind member select.
    */

    const memberSelect =
      $("ajk-member-id");


    if (

      memberSelect &&

      memberSelect.dataset.ajkChangeBound !==
        "true"

    ) {

      memberSelect.addEventListener(
        "change",
        handleMemberChange
      );


      memberSelect.dataset.ajkChangeBound =
        "true";

    }


    /*
      Isi senarai ahli.
    */

    populateMemberSelect();


    /*
      Ambil data yang sudah dimuatkan
      oleh script.js.

      Jika kosong, bina terus daripada AHLI.
    */

    if (

      window.DM3_STATE &&

      Array.isArray(
        window.DM3_STATE.ajk
      ) &&

      window.DM3_STATE.ajk.length

    ) {

      AJK_STATE.data =
        sortAJKData(
          window.DM3_STATE.ajk
        );

    } else {

      AJK_STATE.data =
        sortAJKData(
          buildAJKFromMembers()
        );

    }


    console.log(
      "[DM3 AJK] Initial state:",
      AJK_STATE.data.length,
      "rekod"
    );


    renderAJK();


    /*
      Tandakan module sudah siap.
    */

    AJK_STATE.initialized =
      true;


    /*
      Pasang observer.
    */

    setupAJKObserver();


    /*
      Render semula selepas DOM stabil.
    */
    setTimeout(
      function () {

        autoRenderAJK();

      },
      100
    );


    setTimeout(
      function () {

        autoRenderAJK();

      },
      500
    );


    console.log(
      "DM3 AJK.JS V4.7 READY"
    );

  }


  /* ==========================================================
     PUBLIC API
  ========================================================== */

  window.DM3_AJK = {

    init:
      initAJK,


    load:
      loadAJK,


    render:
      renderAJK,


    open:
      openAJKModal,


    close:
      closeAJKModal,


    add:
      function () {

        openAJKModal();

      },


    edit:
      openAJKModal,


    delete:
      deleteAJK,


    getData:
      function () {

        return AJK_STATE.data;

      },


    refreshUI:
      function () {

        renderAJK();

      }

  };


  /* ==========================================================
     DOM READY
  ========================================================== */

  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      initAJK
    );

  } else {

    initAJK();

  }


})();