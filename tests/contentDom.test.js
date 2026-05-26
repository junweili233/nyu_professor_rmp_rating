// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { injectStyles, removeAlbertRmpEnhancements, repairAlbertRmpLayoutSafeguards, scanAlbertPageOnce, startAlbertRmpEnhancer } from "../src/contentDom.js";

describe("Albert content DOM injection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not scan unrelated NYU pages at startup", () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn();
    const observe = vi.fn();
    const windowMock = {
      location: new URL("https://www.nyu.edu/academics.html"),
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });

    expect(observer).toBeNull();
    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("includes reduced-motion safeguards for injected Albert rating cards", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".nyu-rmp-skeleton");
    expect(styles).toContain("animation: none");
    expect(styles).toContain("transform: none");
  });

  it("marks injected styles with the extension version for live Albert checks", () => {
    injectStyles(document);

    const style = document.getElementById("nyu-rmp-rating-styles");
    expect(style.dataset.nyuRmpVersion).toBe("0.1.2");
    expect(style.textContent).toContain("NYU Albert RMP Ratings v0.1.2");
    expect(style.textContent).toContain("--nyu-rmp-extension-version: \"0.1.2\"");
  });

  it("includes narrow Albert cell layout safeguards for the radar and metrics", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    expect(styles).toContain("container-type: inline-size");
    expect(styles).toContain("@container (max-width: 360px)");
    expect(styles).toContain(".nyu-rmp-metrics");
    expect(styles).toContain("grid-template-columns: 1fr");
    expect(styles).toContain(".nyu-rmp-radar-wrap");
    expect(styles).toContain("justify-items: start");
  });

  it("keeps injected rating cards compact inside wide Albert cells", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    const rootStart = styles.indexOf(".nyu-rmp-rating-root");
    const rootCellStart = styles.indexOf("td > .nyu-rmp-rating-root");
    const cardStart = styles.indexOf(".nyu-rmp-card");
    const rootStyles = styles.slice(rootStart, rootCellStart);
    const cellRootStyles = styles.slice(rootCellStart, cardStart);

    expect(rootStyles).toContain("box-sizing: border-box");
    expect(rootStyles).toContain("justify-self: start");
    expect(rootStyles).toContain("max-width: min(100%, 360px)");
    expect(rootStyles).toContain("width: min(100%, 360px)");
    expect(cellRootStyles).toContain("max-width: min(100%, 320px)");
    expect(cellRootStyles).toContain("width: min(100%, 320px)");
  });

  it("does not use an internal grid layout for processed Albert instructor cells", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    const rootStart = styles.indexOf(".nyu-rmp-rating-root");
    const rootCellStart = styles.indexOf("td > .nyu-rmp-rating-root");
    const rootStyles = styles.slice(rootStart, rootCellStart);

    expect(rootStyles).not.toContain("display: grid");
    expect(rootStyles).toContain("display: block");
    expect(rootStyles).toContain("clear: both");
  });

  it("divides the compact first-view controls into stable rating and tool sections", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    const quickGridStart = styles.indexOf(".nyu-rmp-quick-grid");
    const featureStart = styles.indexOf(".nyu-rmp-feature-actions", quickGridStart);
    const quickGridStyles = styles.slice(quickGridStart, featureStart);
    const narrowQuickStart = styles.indexOf("@container (max-width: 260px)");
    const narrowQuickStyles = styles.slice(narrowQuickStart, styles.indexOf("@container (max-width: 180px)"));

    expect(quickGridStyles).toContain("grid-template-columns: minmax(92px, 0.9fr) minmax(128px, 1.1fr)");
    expect(quickGridStyles).toContain(".nyu-rmp-quick-section");
    expect(quickGridStyles).toContain("display: grid");
    expect(quickGridStyles).toContain("min-width: 0");
    expect(narrowQuickStyles).toContain(".nyu-rmp-quick-grid");
    expect(narrowQuickStyles).toContain("grid-template-columns: 1fr");
    expect(narrowQuickStyles).toContain(".nyu-rmp-feature-actions");
    expect(narrowQuickStyles).toContain("repeat(2, minmax(0, 1fr))");
  });

  it("separates cell-mounted RMP cards from Albert gridcell text flow", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    const cellMountedStart = styles.indexOf(".nyu-rmp-rating-root.is-cell-mounted");
    const nextRuleStart = styles.indexOf(".nyu-rmp-card", cellMountedStart);
    const cellMountedStyles = styles.slice(cellMountedStart, nextRuleStart);

    expect(cellMountedStyles).toContain("display: flow-root");
    expect(cellMountedStyles).toContain("flex-basis: 100%");
    expect(cellMountedStyles).toContain("grid-column: 1 / -1");
    expect(cellMountedStyles).toContain("margin-top: 6px");
    expect(styles).toContain(".nyu-rmp-albert-original");
    expect(styles).toContain(".nyu-rmp-albert-original > *");
    expect(styles).toContain("white-space: normal");
  });

  it("keeps processed Albert cells from squeezing original content into vertical columns", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    const processedCellStart = styles.indexOf('[role="gridcell"][data-nyu-rmp-processed="true"]');
    const originalStart = styles.indexOf('td[data-nyu-rmp-processed="true"] > .nyu-rmp-albert-original');
    const ariaDisplayStart = styles.indexOf('[role="cell"][data-nyu-rmp-processed="true"]', processedCellStart + 1);
    const nextRuleStart = styles.indexOf("display: block", originalStart);
    const processedCellStyles = styles.slice(processedCellStart, originalStart);
    const ariaDisplayStyles = styles.slice(ariaDisplayStart, originalStart);
    const processedChildStyles = styles.slice(originalStart, nextRuleStart);

    expect(processedCellStyles).toContain("align-items: flex-start !important");
    expect(processedCellStyles).toContain("flex-wrap: wrap !important");
    expect(processedCellStyles).toContain("grid-template-columns: minmax(0, 1fr) !important");
    expect(processedCellStyles).toContain("min-inline-size: 0 !important");
    expect(processedCellStyles).toContain("min-width: 0 !important");
    expect(processedCellStyles).toContain("overflow-wrap: normal !important");
    expect(processedCellStyles).toContain("white-space: normal !important");
    expect(processedCellStyles).toContain("word-break: normal !important");
    expect(ariaDisplayStyles).toContain('[role="gridcell"][data-nyu-rmp-processed="true"]');
    expect(ariaDisplayStyles).toContain("display: block !important");
    expect(ariaDisplayStyles).not.toContain("td[data-nyu-rmp-processed");
    expect(ariaDisplayStyles).not.toContain("th[data-nyu-rmp-processed");
    expect(processedChildStyles).toContain("flex: 0 0 100% !important");
    expect(processedChildStyles).toContain("min-inline-size: 0 !important");
    expect(processedChildStyles).toContain("overflow-wrap: normal !important");
    expect(processedChildStyles).toContain("white-space: normal !important");
    expect(processedChildStyles).toContain("width: 100% !important");
    expect(processedChildStyles).toContain("word-break: normal !important");
    expect(processedChildStyles).toContain('[role="gridcell"][data-nyu-rmp-processed="true"] > .nyu-rmp-rating-root.is-cell-mounted');
  });

  it("prevents long RMP text from forcing Albert cells wider", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;

    expect(styles).toContain("overflow-wrap: anywhere");
    expect(styles).toContain("word-break: normal");
    expect(styles).toContain(".nyu-rmp-comments-panel");
    expect(styles).toContain(".nyu-rmp-comment-text");
    expect(styles).toContain(".nyu-rmp-actions");
    expect(styles).toContain("min-width: 0");
    expect(styles).toContain("max-width: 100%");
  });

  it("bounds useful comments so Albert rows do not stretch vertically", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    const panelStart = styles.lastIndexOf(".nyu-rmp-comments-panel");
    const headingStart = styles.indexOf(".nyu-rmp-comments-heading", panelStart);
    const panelStyles = styles.slice(panelStart, headingStart);

    expect(panelStyles).toContain("max-height: 180px");
    expect(panelStyles).toContain("overflow-y: auto");
    expect(panelStyles).toContain("overscroll-behavior: contain");
    expect(panelStyles).toContain("scrollbar-gutter: stable");
  });

  it("hides decorative radar axis labels in extremely narrow Albert cells", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    expect(styles).toContain("width: min(112px, 100%)");
    expect(styles).toContain("@container (max-width: 180px)");
    expect(styles).toContain(".nyu-rmp-radar-axis");
    expect(styles).toContain("display: none");
  });

  it("hides decorative radar axis labels in narrow Albert instructor cells", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    const narrowStart = styles.indexOf("@container (max-width: 360px)");
    const nextContainerStart = styles.indexOf("@container (max-width: 180px)");
    const narrowContainerStyles = styles.slice(narrowStart, nextContainerStart);
    expect(narrowContainerStyles).toContain(".nyu-rmp-radar-axis");
    expect(narrowContainerStyles).toContain("display: none");
  });

  it("styles course-match badges by comment signal state", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    expect(styles).toContain(".nyu-rmp-comments-course-match.is-strong");
    expect(styles).toContain(".nyu-rmp-comments-course-match.is-mixed");
    expect(styles).toContain(".nyu-rmp-comments-course-match.is-weak");
    expect(styles).toContain("background: #fef4f4");
    expect(styles).toContain("color: #a82020");
  });

  it("styles course-matched comment rows by signal state", () => {
    injectStyles(document);

    const styles = document.getElementById("nyu-rmp-rating-styles").textContent;
    expect(styles).toContain(".nyu-rmp-comment.is-course-match.is-strong");
    expect(styles).toContain(".nyu-rmp-comment.is-course-match.is-mixed");
    expect(styles).toContain(".nyu-rmp-comment.is-course-match.is-weak");
    expect(styles).toContain("border-left-color: #b42318");
  });

  it("does not scan Albert pages when the overlay is disabled", () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn();
    const observe = vi.fn();
    const windowMock = {
      location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({
      document,
      window: windowMock,
      lookupProfessor,
      enabled: false,
    });

    expect(observer).toBeNull();
    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("scans Albert pages at startup", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);
    const observe = vi.fn();
    const windowMock = {
      location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });
    await flushPromises();

    expect(observer).not.toBeNull();
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(observe).toHaveBeenCalledWith(document.body, expect.objectContaining({ childList: true, subtree: true }));
  });

  it("scans the live SIS portal Albert host at startup", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);
    const observe = vi.fn();
    const windowMock = {
      location: new URL("https://sis.portal.nyu.edu/psp/ihprod/EMPLOYEE/EMPL/h/?tab=IS_SSS_TAB&jsconfig=IS_ED_SSS_SUMMARYLnk"),
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });
    await flushPromises();

    expect(observer).not.toBeNull();
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(observe).toHaveBeenCalledWith(document.body, expect.objectContaining({ childList: true, subtree: true }));
  });

  it("passes Albert course context with professor lookup requests", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 202 Operating Systems</td>
            <td>Walfish</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Walfish", { courseCode: "CSCI-UA 202" });
  });

  it("subscribes to in-place Albert text and metadata updates", async () => {
    document.body.innerHTML = `<div>Loading class details</div>`;
    const lookupProfessor = vi.fn(async () => null);
    const observe = vi.fn();
    const windowMock = {
      location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });
    await flushPromises();

    expect(observer).not.toBeNull();
    expect(observe).toHaveBeenCalledWith(document.body, expect.objectContaining({
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: expect.arrayContaining(["aria-colindex", "aria-label", "aria-labelledby", "aria-describedby", "class", "data-instructor-name", "data-label", "data-name", "data-tooltip", "headers", "hidden", "role", "selected", "style", "title", "value"]),
    }));
  });

  it("cancels a pending Albert rescan when the overlay observer disconnects", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);
    let mutationCallback;
    const windowMock = {
      location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      MutationObserver: class {
        constructor(callback) {
          mutationCallback = callback;
        }

        observe = vi.fn();
        disconnect = vi.fn();
      },
      clearTimeout,
      setTimeout,
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });
    await flushPromises();
    removeAlbertRmpEnhancements(document);

    mutationCallback();
    observer.disconnect();
    await vi.advanceTimersByTimeAsync(300);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("rescans when Albert updates an existing instructor form control", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <label for="instructor-field">Instructor</label>
      <input id="instructor-field" readonly value="" />
    `;
    const lookupProfessor = vi.fn(async () => null);
    const windowMock = {
      location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      MutationObserver: class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
      clearTimeout,
      setTimeout,
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });
    await flushPromises();

    document.getElementById("instructor-field").value = "YAP, CHEE KENG";
    document.getElementById("instructor-field").dispatchEvent(new Event("input", { bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);

    expect(observer).not.toBeNull();
    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
  });

  it("scans blank child frames owned by an Albert parent page", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);
    const observe = vi.fn();
    const windowMock = {
      location: new URL("about:blank"),
      parent: {
        location: new URL("https://albert.nyu.edu/psc/csprod/EMPLOYEE/SA/c/NUI_FRAMEWORK.PT_LANDINGPAGE.GBL"),
      },
      MutationObserver: class {
        observe = observe;
      },
      clearTimeout: vi.fn(),
      setTimeout: vi.fn(),
    };

    const observer = startAlbertRmpEnhancer({ document, window: windowMock, lookupProfessor });
    await flushPromises();

    expect(observer).not.toBeNull();
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(observe).toHaveBeenCalledWith(document.body, expect.objectContaining({ childList: true, subtree: true }));
  });

  it("injects one RMP card per Albert instructor and updates it with rating data", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;

    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      wouldTakeAgain: 24.2857,
      tags: ["Tough grader"],
      topComments: ["Avoid if you dislike fast lectures."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    const mounted = scanAlbertPageOnce({ document, lookupProfessor });
    await Promise.all(mounted.pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("2.1");
    expect(document.querySelector(".nyu-rmp-score").getAttribute("aria-label")).toBe("RMP rating 2.1 out of 5");
    expect(document.body.textContent).toContain("Low rating");
    expect(document.body.textContent).toContain("Computer Science");
    expect(document.body.textContent).toContain("Difficulty 4.5");
    expect(document.body.textContent).toContain("Avoid if you dislike fast lectures.");
  });

  it("shows the nearby Albert course context on the RMP card", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;

    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 47,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const courseContext = document.querySelector(".nyu-rmp-course-context");
    expect(courseContext).not.toBeNull();
    expect(courseContext.getAttribute("role")).toBe("note");
    expect(courseContext.getAttribute("aria-label")).toBe("Albert course context: CSCI-UA 201");
    expect(courseContext.textContent.replace(/\s+/g, " ").trim()).toBe("Albert CSCI-UA 201");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("Albert course CSCI-UA 201");
  });

  it("keeps the Albert course context visible while RMP is loading, missing, or failed", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
          <tr>
            <td>CSCI-UA 202 Operating Systems</td>
            <td>Instructor: Grace Hopper</td>
          </tr>
          <tr>
            <td>CSCI-UA 310 Basic Algorithms</td>
            <td>Instructor: Alan Turing</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn((name) => {
      if (name === "Ada Lovelace") {
        return new Promise(() => {});
      }
      if (name === "Grace Hopper") {
        return Promise.resolve(null);
      }
      return Promise.reject(new Error("RMP lookup failed"));
    });

    scanAlbertPageOnce({ document, lookupProfessor });
    await flushPromises();

    const cards = Array.from(document.querySelectorAll(".nyu-rmp-card"));
    const courseLabels = cards.map((card) => card.querySelector(".nyu-rmp-course-context")?.getAttribute("aria-label"));
    expect(courseLabels).toEqual([
      "Albert course context: CSCI-UA 201",
      "Albert course context: CSCI-UA 202",
      "Albert course context: CSCI-UA 310",
    ]);
    expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
      "Checking RMP rating for Ada Lovelace, Albert course CSCI-UA 201",
      "No RMP match for Grace Hopper, Albert course CSCI-UA 202",
      "RMP lookup failed for Alan Turing, Albert course CSCI-UA 310: RMP lookup failed",
    ]);
  });

  it("labels injected rating cards with a concise accessible summary", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    const mounted = scanAlbertPageOnce({ document, lookupProfessor });
    const card = document.querySelector(".nyu-rmp-card");

    expect(card.getAttribute("role")).toBe("group");
    expect(card.getAttribute("aria-busy")).toBe("true");
    expect(card.getAttribute("aria-label")).toBe("Checking RMP rating for Ada Lovelace");

    await Promise.all(mounted.pendingLookups);

    expect(card.hasAttribute("aria-busy")).toBe(false);
    expect(card.getAttribute("aria-label")).toBe("RMP rating for Ada Lovelace: 4.7 out of 5, department Computer Science, Strong rating, recommendation Pick with confidence, professor fit 82 out of 100 based on 3 of 4 radar metrics, limited data, 38 ratings, difficulty 2.4 out of 5, ease 2.6 out of 5, take again N/A, 0 useful comments shown");
  });

  it("does not present missing RMP rating counts as zero ratings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const card = document.querySelector(".nyu-rmp-card");
    expect(card.getAttribute("aria-label")).toBe("RMP rating for Ada Lovelace: 4.7 out of 5, department Computer Science, Strong rating, recommendation Limited RMP data, professor fit 82 out of 100 based on 2 of 4 radar metrics, limited data, N/A ratings, difficulty 2.4 out of 5, ease 2.6 out of 5, take again N/A, 0 useful comments shown");
    expect(document.querySelector(".nyu-rmp-rating-count").textContent).toBe("N/A ratings");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("N/A ratings");
    expect(document.body.textContent).not.toContain("0 ratings");
  });

  it("summarizes difficulty, ease, and take-again in the rating card accessible label", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toBe(
      "RMP rating for Ada Lovelace: 4.7 out of 5, department Computer Science, Strong rating, recommendation Pick with confidence, professor fit 84 out of 100 based on 4 of 4 radar metrics, 38 ratings, difficulty 2.4 out of 5, ease 2.6 out of 5, take again 92%, 0 useful comments shown",
    );
  });

  it("includes the RMP department in the rating card accessible label", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("department Computer Science");
  });

  it("includes the rating verdict in the rating card accessible label", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      wouldTakeAgain: 24,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("Low rating");
  });

  it("renders a concise pick recommendation from the professor fit score", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.1,
      ratingsCount: 64,
      wouldTakeAgain: 91,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const recommendation = document.querySelector(".nyu-rmp-recommendation");
    expect(recommendation.getAttribute("role")).toBe("note");
    expect(recommendation.getAttribute("aria-label")).toBe("RMP pick recommendation: Pick with confidence");
    expect(recommendation.textContent.replace(/\s+/g, " ").trim()).toBe("Pick with confidence Strong fit from RMP signals");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("recommendation Pick with confidence");
  });

  it("shows the metric evidence behind a strong pick recommendation", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.1,
      ratingsCount: 64,
      wouldTakeAgain: 91,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const evidence = document.querySelector(".nyu-rmp-evidence");
    expect(evidence.getAttribute("role")).toBe("list");
    expect(evidence.getAttribute("aria-label")).toBe("RMP recommendation evidence");
    expect(Array.from(evidence.children).map((node) => node.getAttribute("role"))).toEqual([
      "listitem",
      "listitem",
      "listitem",
      "listitem",
    ]);
    expect(Array.from(evidence.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toEqual([
      "Strong rating 4.7/5",
      "Manageable difficulty 2.1/5",
      "High take-again 91%",
      "64 ratings",
    ]);
    expect(Array.from(evidence.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.className)).toEqual([
      "nyu-rmp-evidence-chip is-strong",
      "nyu-rmp-evidence-chip is-strong",
      "nyu-rmp-evidence-chip is-strong",
      "nyu-rmp-evidence-chip is-strong",
    ]);
    expect(Array.from(evidence.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.getAttribute("aria-label"))).toEqual([
      "Support signal: Strong rating 4.7/5",
      "Support signal: Manageable difficulty 2.1/5",
      "Support signal: High take-again 91%",
      "Support signal: 64 ratings",
    ]);
  });

  it("shows concrete risk evidence for a weak pick recommendation", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      wouldTakeAgain: 24,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const evidence = document.querySelector(".nyu-rmp-evidence");
    expect(evidence.getAttribute("aria-label")).toBe("RMP recommendation evidence");
    expect(Array.from(evidence.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toEqual([
      "Low rating 2.1/5",
      "High difficulty 4.5/5",
      "Low take-again 24%",
      "92 ratings",
    ]);
    expect(Array.from(evidence.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.className)).toEqual([
      "nyu-rmp-evidence-chip is-weak",
      "nyu-rmp-evidence-chip is-weak",
      "nyu-rmp-evidence-chip is-weak",
      "nyu-rmp-evidence-chip is-strong",
    ]);
    expect(Array.from(evidence.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.getAttribute("aria-label"))).toEqual([
      "Risk signal: Low rating 2.1/5",
      "Risk signal: High difficulty 4.5/5",
      "Risk signal: Low take-again 24%",
      "Support signal: 92 ratings",
    ]);
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("recommendation Avoid if possible");
  });

  it("warns when a high professor fit score is based on sparse RMP data", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const recommendation = document.querySelector(".nyu-rmp-recommendation");
    expect(recommendation.getAttribute("aria-label")).toBe("RMP pick recommendation: Limited RMP data");
    expect(recommendation.textContent.replace(/\s+/g, " ").trim()).toBe("Limited RMP data Check RMP before picking");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("recommendation Limited RMP data");
  });

  it("keeps excellent but tiny RMP samples in the limited-data recommendation state", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 5,
      difficulty: 1,
      ratingsCount: 2,
      wouldTakeAgain: 100,
      tags: [],
      topComments: ["Only two students rated this professor."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const recommendation = document.querySelector(".nyu-rmp-recommendation");
    const evidence = document.querySelector(".nyu-rmp-evidence");
    expect(recommendation.getAttribute("aria-label")).toBe("RMP pick recommendation: Limited RMP data");
    expect(recommendation.textContent.replace(/\s+/g, " ").trim()).toBe("Limited RMP data Only 2 RMP ratings");
    expect(evidence.textContent).toContain("2 ratings");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("recommendation Limited RMP data");
  });

  it("keeps high-score RMP results with unknown rating volume in the limited-data recommendation state", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 5,
      difficulty: 1,
      wouldTakeAgain: 100,
      tags: [],
      topComments: ["The visible score is high, but rating volume is unknown."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const recommendation = document.querySelector(".nyu-rmp-recommendation");
    const evidence = document.querySelector(".nyu-rmp-evidence");
    const fitClassTokens = document.querySelector(".nyu-rmp-radar-fit").getAttribute("class").split(/\s+/);
    expect(recommendation.getAttribute("aria-label")).toBe("RMP pick recommendation: Limited RMP data");
    expect(recommendation.textContent.replace(/\s+/g, " ").trim()).toBe("Limited RMP data RMP rating count unavailable");
    expect(evidence.textContent).toContain("N/A ratings");
    expect(fitClassTokens.filter((token) => token === "is-limited")).toHaveLength(1);
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("recommendation Limited RMP data");
  });

  it("renders rating cards with a dedicated metrics grid and comment panel", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: ["Helpful"],
      topComments: ["Explains low-level systems clearly."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metrics = document.querySelector(".nyu-rmp-metrics");
    expect(metrics).not.toBeNull();
    expect(metrics.querySelectorAll(".nyu-rmp-metric")).toHaveLength(3);
    expect(metrics.textContent).toContain("Rating");
    expect(metrics.textContent).toContain("Difficulty");
    expect(metrics.textContent).toContain("Take again");
    expect(document.querySelector(".nyu-rmp-comments-panel")).not.toBeNull();
  });

  it("labels rendered RMP tag chips with the exact tag count", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: ["Clear grading", "Respected"],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const tags = document.querySelector(".nyu-rmp-tags");
    expect(tags.getAttribute("role")).toBe("list");
    expect(tags.getAttribute("aria-label")).toBe("RMP professor tags, 2 shown");
    expect(Array.from(tags.children).map((node) => node.getAttribute("role"))).toEqual(["listitem", "listitem"]);
    expect(tags.textContent.replace(/\s+/g, " ").trim()).toBe("Clear grading Respected");
  });

  it("shows only the RMP score and feature buttons before optional panels are opened", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: ["Helpful"],
      topComments: ["Explains low-level systems clearly."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const card = document.querySelector(".nyu-rmp-card");
    const quickGrid = card.querySelector(".nyu-rmp-quick-grid");
    const scoreStrip = card.querySelector(".nyu-rmp-score-strip");
    const quickSections = Array.from(card.querySelectorAll(".nyu-rmp-quick-section"));
    const toggles = Array.from(card.querySelectorAll(".nyu-rmp-feature-toggle"));
    const visibleChildClasses = Array.from(card.children)
      .filter((node) => !node.hidden)
      .map((node) => node.className);
    expect(quickGrid.getAttribute("aria-label")).toBe("RMP quick view for Ada Lovelace");
    expect(quickSections.map((section) => section.className)).toEqual([
      "nyu-rmp-quick-section is-score",
      "nyu-rmp-quick-section is-tools",
    ]);
    expect(quickSections.map((section) => section.getAttribute("aria-label"))).toEqual([
      "RMP score for Ada Lovelace",
      "Optional RMP tools for Ada Lovelace",
    ]);
    expect(scoreStrip.textContent.replace(/\s+/g, " ").trim()).toBe("RMP 4.7 Strong rating 38 ratings");
    expect(toggles.map((button) => button.textContent)).toEqual(["Recent comments", "Radar map"]);
    expect(toggles.map((button) => button.getAttribute("aria-expanded"))).toEqual(["false", "false"]);
    expect(quickGrid.textContent.replace(/\s+/g, " ").trim()).toBe("RMP 4.7 Strong rating 38 ratings Recent comments Radar map");
    expect(quickGrid.textContent).not.toContain("Computer Science");
    expect(quickGrid.textContent).not.toContain("Difficulty");
    expect(quickGrid.textContent).not.toContain("Take again");
    expect(quickGrid.textContent).not.toContain("Helpful");
    expect(quickGrid.textContent).not.toContain("Explains low-level systems clearly.");
    expect(visibleChildClasses).toEqual(["nyu-rmp-quick-grid"]);
    expect(card.querySelector(":scope > .nyu-rmp-card-head")).toBeNull();
    expect(card.querySelector(":scope > .nyu-rmp-department")).toBeNull();
    expect(card.querySelector(":scope > .nyu-rmp-course-context")).toBeNull();
    expect(card.querySelector(":scope > .nyu-rmp-actions")).toBeNull();
    expect(card.querySelector(".nyu-rmp-comments-panel").hidden).toBe(true);
    expect(card.querySelector(".nyu-rmp-radar-panel").hidden).toBe(true);
    expect(card.querySelector(".nyu-rmp-recommendation").closest(".nyu-rmp-radar-panel").hidden).toBe(true);
    expect(card.querySelector(".nyu-rmp-tags").closest(".nyu-rmp-radar-panel").hidden).toBe(true);
  });

  it("reveals recent comments and radar map only when their buttons are clicked", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: ["Helpful"],
      topComments: ["Explains low-level systems clearly."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const [commentsButton, radarButton] = document.querySelectorAll(".nyu-rmp-feature-toggle");
    const commentsPanel = document.querySelector(".nyu-rmp-comments-panel");
    const radarPanel = document.querySelector(".nyu-rmp-radar-panel");
    commentsButton.click();
    expect(commentsButton.getAttribute("aria-expanded")).toBe("true");
    expect(commentsPanel.hidden).toBe(false);
    expect(radarPanel.hidden).toBe(true);

    radarButton.click();
    expect(radarButton.getAttribute("aria-expanded")).toBe("true");
    expect(radarPanel.hidden).toBe(false);
    expect(commentsPanel.hidden).toBe(false);
  });

  it("labels useful comment lists with the exact rendered comment count", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: [],
      topComments: [
        "Explains low-level systems clearly.",
        "Projects are practical and graded fairly.",
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const comments = document.querySelector(".nyu-rmp-comments");
    expect(comments.getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 2 shown");
    expect(comments.querySelectorAll("li")).toHaveLength(2);
  });

  it("labels the comments panel as a region even when RMP has no useful comments", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const panel = document.querySelector(".nyu-rmp-comments-panel");
    expect(panel.getAttribute("role")).toBe("region");
    expect(panel.getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 0 shown");
    expect(panel.querySelector(".nyu-rmp-comments-empty").textContent).toBe("No useful comments found in the 20-rating RMP sample.");
  });

  it("keeps the take-again metric visible when RMP omits take-again data", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metrics = document.querySelector(".nyu-rmp-metrics");
    expect(metrics.querySelectorAll(".nyu-rmp-metric")).toHaveLength(3);
    expect(metrics.textContent).toContain("Take again");
    expect(metrics.textContent).toContain("Take again N/A");
    expect(Array.from(document.querySelectorAll(".nyu-rmp-radar-legend li")).map((node) => node.textContent)).toContain("Take again N/A");
  });

  it("shows the professor ease value beside difficulty in the visible metrics", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const difficultyMetric = Array.from(document.querySelectorAll(".nyu-rmp-metric"))
      .find((metric) => metric.querySelector(".nyu-rmp-metric-label")?.textContent === "Difficulty");

    expect(difficultyMetric.textContent).toContain("Difficulty 2.4");
    expect(difficultyMetric.textContent).toContain("Ease 2.6/5");
  });

  it("renders rating metrics as semantic description-list pairs", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metrics = document.querySelector(".nyu-rmp-metrics");
    expect(metrics.tagName).toBe("DL");
    expect(metrics.getAttribute("aria-label")).toBe("RMP metrics for Ada Lovelace");
    expect(Array.from(metrics.querySelectorAll(".nyu-rmp-metric-label")).map((node) => node.tagName)).toEqual(["DT", "DT", "DT"]);
    expect(Array.from(metrics.querySelectorAll(".nyu-rmp-metric-value")).map((node) => node.tagName)).toEqual(["DD", "DD", "DD"]);
    expect(document.querySelector(".nyu-rmp-score").tagName).toBe("DD");
  });

  it("renders an accessible radar chart from professor rating metrics", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const radarWrap = document.querySelector(".nyu-rmp-radar-wrap");
    const radar = document.querySelector(".nyu-rmp-radar");
    expect(radarWrap.getAttribute("role")).toBe("group");
    expect(radarWrap.getAttribute("aria-label")).toBe("Professor fit radar for Ada Lovelace");
    expect(radar).not.toBeNull();
    expect(radar.getAttribute("role")).toBe("img");
    expect(radar.getAttribute("aria-label")).toBe("Professor radar: professor fit 82 out of 100, rating 4.5 out of 5, ease 3.0 out of 5, take again 80%, 64 ratings");
    expect(radar.querySelector(".nyu-rmp-radar-shape")).not.toBeNull();
    expect(Array.from(radar.querySelectorAll(".nyu-rmp-radar-axis")).map((node) => node.textContent)).toEqual([
      "Rating",
      "Ease",
      "Volume",
      "Again",
    ]);
  });

  it("adds useful-comment signal to the professor radar when comments are available", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: ["Clear grading criteria"],
      topComments: [
        "Explains systems clearly and gives helpful labs.",
        "Fair exams, but projects are hard if you start late.",
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const radar = document.querySelector(".nyu-rmp-radar");
    const fit = document.querySelector(".nyu-rmp-radar-fit");
    const legend = document.querySelector(".nyu-rmp-radar-legend");

    expect(Array.from(radar.querySelectorAll(".nyu-rmp-radar-axis")).map((node) => node.textContent)).toEqual([
      "Rating",
      "Ease",
      "Volume",
      "Again",
      "Comments",
    ]);
    expect(fit.getAttribute("aria-label")).toBe("Professor fit score 83 out of 100, based on 5 of 5 radar metrics");
    expect(radar.getAttribute("aria-label")).toContain("comment signal 86 out of 100");
    expect(radar.querySelector("desc")?.textContent).toContain("comment signal 86 out of 100");
    expect(Array.from(legend.querySelectorAll("li")).map((node) => node.textContent)).toContain("Comments 86/100");
    const commentLegendItem = Array.from(legend.querySelectorAll("li")).find((node) => node.textContent === "Comments 86/100");
    expect(commentLegendItem.className).toBe("nyu-rmp-radar-legend-item is-strong");
    expect(commentLegendItem.getAttribute("aria-label")).toBe("Support signal: Comments 86/100");
    expect(Array.from(document.querySelectorAll(".nyu-rmp-radar-node")).map((node) => node.getAttribute("aria-label"))).toContain("Radar metric Comments: 86 out of 100");
    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("Positive comment signal 86/100");
  });

  it("weights Albert course-matched comments more heavily in the radar comment signal", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: [],
      topComments: [
        "Clear helpful fair great lectures overall.",
        {
          text: "CS201 projects are hard, confusing, overwhelming, avoid if behind.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 25/100");
    expect(Array.from(document.querySelectorAll(".nyu-rmp-radar-legend li")).map((node) => node.textContent)).toContain("Comments 25/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 25 out of 100");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("CSCI-UA 201 comment risk 25 out of 100");
    const badge = document.querySelector(".nyu-rmp-comments-course-match");
    expect(badge.textContent).toBe("1 CSCI-UA 201 match");
    expect(badge.className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(badge.getAttribute("aria-label")).toBe("Risk signal: 1 useful comment matches Albert course CSCI-UA 201");
  });

  it("labels positive Albert course-matched comment support in the evidence chips", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: [],
      topComments: [
        {
          text: "CS201 lectures are clear, helpful, fair, and organized.",
          course: "CSCI-UA 201",
        },
        "Generic warning: hard and confusing if you skip class.",
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 86/100");
    expect(Array.from(document.querySelectorAll(".nyu-rmp-radar-legend li")).map((node) => node.textContent)).toContain("Comments 86/100");
    const badge = document.querySelector(".nyu-rmp-comments-course-match");
    expect(badge.textContent).toBe("1 CSCI-UA 201 match");
    expect(badge.className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(badge.getAttribute("aria-label")).toBe("Support signal: 1 useful comment matches Albert course CSCI-UA 201");
  });

  it("treats demanding CS201 workload comments as a course risk signal", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 3.5,
      ratingsCount: 64,
      wouldTakeAgain: 78,
      tags: [],
      topComments: [
        {
          text: "CS201 has a demanding workload and heavy projects every week.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats not-helpful CS201 comments as a course risk signal", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.1,
      difficulty: 3.4,
      ratingsCount: 64,
      wouldTakeAgain: 76,
      tags: [],
      topComments: [
        {
          text: "CS201 lectures are not helpful and exams feel unfair.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats negated clear and fair CS201 comments as course risk signals", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 3.2,
      ratingsCount: 58,
      wouldTakeAgain: 73,
      tags: [],
      topComments: [
        {
          text: "CS201 lectures are not clear and the exams are not fair.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats negated CS201 workload risk words as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.3,
      difficulty: 2.7,
      ratingsCount: 72,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 is not hard, not confusing, and not demanding.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats not-heavy CS201 workload comments as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.3,
      difficulty: 2.4,
      ratingsCount: 72,
      wouldTakeAgain: 84,
      tags: [],
      topComments: [
        {
          text: "CS201 has a not heavy workload and lectures are not too fast.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats light CS201 workload comments as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 has a light workload and reasonable homework.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats easy labs and responsive office hours as CS201 comment support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.0,
      difficulty: 2.8,
      ratingsCount: 49,
      wouldTakeAgain: 79,
      tags: [],
      topComments: [
        {
          text: "CS201 labs are easy to follow and office hours are responsive.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats unavailable CS201 office hours as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.0,
      difficulty: 3.2,
      ratingsCount: 49,
      wouldTakeAgain: 70,
      tags: [],
      topComments: [
        {
          text: "CS201 office hours are not responsive and there are no office hours before exams.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats harsh CS201 grading and no curve as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.4,
      ratingsCount: 61,
      wouldTakeAgain: 68,
      tags: [],
      topComments: [
        {
          text: "CS201 grading is harsh and there is no curve for exams.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats brutal CS201 exams as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.4,
      ratingsCount: 61,
      wouldTakeAgain: 68,
      tags: [],
      topComments: [
        {
          text: "CS201 exams are brutal and sometimes feel impossible.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats rude CS201 instructor comments as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.4,
      ratingsCount: 61,
      wouldTakeAgain: 68,
      tags: [],
      topComments: [
        {
          text: "CS201 instructor is rude and condescending during lectures.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats slow CS201 feedback and unanswered emails as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.4,
      ratingsCount: 61,
      wouldTakeAgain: 68,
      tags: [],
      topComments: [
        {
          text: "CS201 feedback is slow and emails go unanswered.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats vague CS201 project specs as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.4,
      ratingsCount: 61,
      wouldTakeAgain: 68,
      tags: [],
      topComments: [
        {
          text: "CS201 project specs are vague and assignments can feel ambiguous.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats forced CS201 group projects as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.4,
      ratingsCount: 61,
      wouldTakeAgain: 68,
      tags: [],
      topComments: [
        {
          text: "CS201 has forced group projects and uneven teams.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats choosing CS201 project partners as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 lets you choose partners for group projects.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats mandatory CS201 attendance and graded participation as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.4,
      ratingsCount: 61,
      wouldTakeAgain: 68,
      tags: [],
      topComments: [
        {
          text: "CS201 attendance is mandatory and participation is graded.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats optional CS201 attendance as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 attendance is optional and lectures are recorded.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats no-late CS201 deadline policies as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.4,
      ratingsCount: 61,
      wouldTakeAgain: 68,
      tags: [],
      topComments: [
        {
          text: "CS201 has strict deadlines, no late submissions, and no extensions.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats no-partial-credit CS201 grading as course risk", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.4,
      ratingsCount: 61,
      wouldTakeAgain: 68,
      tags: [],
      topComments: [
        {
          text: "CS201 gives no partial credit and deducts points for small mistakes.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment risk 0/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 0 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-weak");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-weak");
  });

  it("treats lenient CS201 grading as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 has lenient grading on exams and homework.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats CS201 partial credit as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 gives partial credit on exams and homework.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats detailed CS201 rubrics as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 has detailed rubrics for projects and homework.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats flexible CS201 deadlines and extensions as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 allows extensions and has flexible deadlines for projects.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats quick CS201 feedback and replies as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 feedback is quick and emails get replies.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats CS201 forum question help as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 answers questions on Ed and Piazza posts clarify labs.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats CS201 starter code and autograder feedback as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 provides starter code and autograder feedback for projects.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats CS201 practice exams and review sessions as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 practice exams and review sessions match the real exams.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats open-note CS201 exams as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 exams are open-note and open book if you understand the labs.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats posted CS201 slides and recordings as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 lecture slides and recordings are posted after class.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats curved CS201 exams as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 has a generous curve on exams.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats CS201 extra credit and bonus points as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 offers extra credit and bonus points on assignments.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("treats dropped lowest CS201 quiz and homework policies as course support", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 61,
      wouldTakeAgain: 82,
      tags: [],
      topComments: [
        {
          text: "CS201 drops the lowest quiz and one homework assignment.",
          course: "CSCI-UA 201",
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 201 comment support 100/100");
    expect(document.querySelector(".nyu-rmp-radar").getAttribute("aria-label")).toContain("comment signal 100 out of 100");
    expect(document.querySelector(".nyu-rmp-comments-course-match").className).toBe("nyu-rmp-comments-course-match is-strong");
    expect(document.querySelector(".nyu-rmp-comment").className).toBe("nyu-rmp-comment is-course-match is-strong");
  });

  it("summarizes the professor radar as a rating-weighted fit score", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const radar = document.querySelector(".nyu-rmp-radar");
    const fit = document.querySelector(".nyu-rmp-radar-fit");
    const weightingNote = document.querySelector(".nyu-rmp-radar-weight-note");
    expect(fit).not.toBeNull();
    expect(fit.getAttribute("aria-label")).toBe("Professor fit score 82 out of 100, based on 4 of 4 radar metrics");
    expect(fit.textContent).toContain("Fit 82");
    expect(fit.textContent).toContain("4/4 metrics");
    expect(weightingNote.getAttribute("role")).toBe("note");
    expect(weightingNote.textContent).toBe("Rating-led fit: rating counts most.");
    expect(radar.getAttribute("aria-label")).toContain("professor fit 82 out of 100");
    expect(radar.querySelector("desc")?.textContent).toContain("Professor fit 82 out of 100.");
  });

  it("colors the radar with the strong recommendation state", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const radarWrap = document.querySelector(".nyu-rmp-radar-wrap");
    const fit = document.querySelector(".nyu-rmp-radar-fit");
    expect(radarWrap.classList.contains("is-strong")).toBe(true);
    expect(fit.classList.contains("is-strong")).toBe(true);
  });

  it("colors the radar with the weak recommendation state", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      wouldTakeAgain: 24,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const radarWrap = document.querySelector(".nyu-rmp-radar-wrap");
    const fit = document.querySelector(".nyu-rmp-radar-fit");
    expect(radarWrap.classList.contains("is-weak")).toBe(true);
    expect(fit.classList.contains("is-weak")).toBe(true);
  });

  it("counts present zero-value radar metrics against the professor fit score", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 0,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const fit = document.querySelector(".nyu-rmp-radar-fit");
    const radar = document.querySelector(".nyu-rmp-radar");
    expect(fit.getAttribute("aria-label")).toBe("Professor fit score 66 out of 100, based on 4 of 4 radar metrics");
    expect(fit.textContent).toContain("Fit 66");
    expect(fit.textContent).toContain("4/4 metrics");
    expect(radar.getAttribute("aria-label")).toContain("professor fit 66 out of 100");
    expect(Array.from(document.querySelectorAll(".nyu-rmp-radar-legend li")).map((node) => node.textContent)).toContain("Take again 0%");
  });

  it("describes radar charts with native SVG title and description", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const radar = document.querySelector(".nyu-rmp-radar");
    expect(radar.querySelector("title")?.textContent).toBe("Professor rating radar");
    expect(radar.querySelector("desc")?.textContent).toBe("Professor fit 82 out of 100. Rating 4.5 out of 5, ease 3.0 out of 5, take again 80%, 64 ratings.");
  });

  it("wires radar SVG title and description with stable ARIA references", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const radar = document.querySelector(".nyu-rmp-radar");
    const title = radar.querySelector("title");
    const desc = radar.querySelector("desc");
    expect(title.id).toMatch(/^nyu-rmp-radar-title-\d+$/);
    expect(desc.id).toMatch(/^nyu-rmp-radar-desc-\d+$/);
    expect(radar.getAttribute("aria-labelledby")).toBe(title.id);
    expect(radar.getAttribute("aria-describedby")).toBe(desc.id);
  });

  it("renders a compact radar legend with exact axis values", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const legend = document.querySelector(".nyu-rmp-radar-legend");
    expect(legend).not.toBeNull();
    expect(legend.getAttribute("aria-label")).toBe("Radar chart values");
    expect(Array.from(legend.querySelectorAll("li")).map((node) => node.textContent)).toEqual([
      "Rating 4.5/5",
      "Ease 3.0/5",
      "Volume 64",
      "Take again 80%",
    ]);
  });

  it("marks radar legend axes with risk and support states", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>Instructor: Chee Keng Yap</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      wouldTakeAgain: 24,
      tags: [],
      topComments: [
        { text: "CS201 projects are hard, confusing, overwhelming, avoid if behind.", course: "CSCI-UA 201" },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const legendItems = Array.from(document.querySelectorAll(".nyu-rmp-radar-legend li"));
    expect(legendItems.map((node) => node.textContent)).toEqual([
      "Rating 2.1/5",
      "Ease 0.5/5",
      "Volume 92",
      "Take again 24%",
      "Comments 0/100",
    ]);
    expect(legendItems.map((node) => node.className)).toEqual([
      "nyu-rmp-radar-legend-item is-weak",
      "nyu-rmp-radar-legend-item is-weak",
      "nyu-rmp-radar-legend-item is-strong",
      "nyu-rmp-radar-legend-item is-weak",
      "nyu-rmp-radar-legend-item is-weak",
    ]);
    expect(legendItems.map((node) => node.getAttribute("aria-label"))).toEqual([
      "Risk signal: Rating 2.1/5",
      "Risk signal: Ease 0.5/5",
      "Support signal: Volume 92",
      "Risk signal: Take again 24%",
      "Risk signal: Comments 0/100",
    ]);
  });

  it("renders labeled radar nodes for each professor fit metric", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      ratingsCount: 64,
      wouldTakeAgain: 80,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const nodes = Array.from(document.querySelectorAll(".nyu-rmp-radar-node"));
    expect(nodes).toHaveLength(4);
    expect(nodes.map((node) => node.getAttribute("aria-label"))).toEqual([
      "Radar metric Rating: 4.5 out of 5",
      "Radar metric Ease: 3.0 out of 5",
      "Radar metric Volume: 64 ratings",
      "Radar metric Take again: 80%",
    ]);
    expect(nodes.map((node) => node.querySelector("title")?.textContent)).toEqual([
      "Rating: 4.5 out of 5",
      "Ease: 3.0 out of 5",
      "Volume: 64 ratings",
      "Take again: 80%",
    ]);
  });

  it("keeps radar labels and points stable when RMP metrics are partial", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.5,
      difficulty: 2.0,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const radar = document.querySelector(".nyu-rmp-radar");
    const fit = document.querySelector(".nyu-rmp-radar-fit");
    const shapePoints = radar.querySelector(".nyu-rmp-radar-shape").getAttribute("points");
    expect(fit.classList.contains("is-limited")).toBe(true);
    expect(fit.getAttribute("aria-label")).toBe("Professor fit score 81 out of 100, based on 2 of 4 radar metrics, limited data");
    expect(fit.textContent).toContain("Limited data");
    expect(fit.textContent).toContain("2/4 metrics");
    expect(radar.getAttribute("aria-label")).toBe("Professor radar: professor fit 81 out of 100, limited data, rating 4.5 out of 5, ease 3.0 out of 5, take again N/A, N/A ratings");
    expect(radar.querySelector("desc")?.textContent).toBe("Professor fit 81 out of 100. Limited data: 2 of 4 radar metrics available. Rating 4.5 out of 5, ease 3.0 out of 5, take again N/A, N/A ratings.");
    expect(shapePoints).not.toMatch(/NaN|Infinity/);
    const legend = document.querySelector(".nyu-rmp-radar-legend");
    expect(legend.getAttribute("aria-label")).toBe("Radar chart values, limited data: 2 of 4 metrics available");
    expect(Array.from(legend.querySelectorAll("li")).map((node) => node.textContent)).toEqual([
      "Rating 4.5/5",
      "Ease 3.0/5",
      "Volume N/A",
      "Take again N/A",
    ]);
  });

  it("renders useful-comment metadata from RMP ratings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: [],
      topComments: [
        {
          text: "Explains low-level systems clearly and gives practical labs.",
          course: "CSCI-UA 201",
          helpfulRating: 11,
          clarityRating: 5,
          difficultyRating: 2,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.body.textContent).toContain("Explains low-level systems clearly and gives practical labs.");
    expect(document.body.textContent).toContain("Course CSCI-UA 201");
    expect(document.body.textContent).toContain("11 useful");
    expect(document.body.textContent).toContain("Clarity 5.0");
    expect(document.body.textContent).toContain("Difficulty 2.0");
  });

  it("marks useful comments that match the nearby Albert course", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "CS201 projects are hard, confusing, overwhelming, avoid if behind.",
          course: "CSCI-UA 201",
          helpfulRating: 14,
          clarityRating: 2,
          difficultyRating: 5,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    const comment = document.querySelector(".nyu-rmp-comment");
    expect(metadata.textContent).toContain("Course CSCI-UA 201 (Albert match)");
    expect(metadata.classList.contains("is-course-match")).toBe(true);
    expect(comment.classList.contains("is-course-match")).toBe(true);
    expect(comment.classList.contains("is-weak")).toBe(true);
    expect(comment.getAttribute("aria-label")).toBe("Risk signal: useful comment matches Albert course CSCI-UA 201");
  });

  it("labels when useful RMP comments do not match the nearby Albert course", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Useful but from a different course.",
          course: "CSCI-UA 102",
          helpfulRating: 14,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const badge = document.querySelector(".nyu-rmp-comments-course-match");
    const comments = document.querySelector(".nyu-rmp-comments");
    const panel = document.querySelector(".nyu-rmp-comments-panel");
    expect(badge.textContent).toBe("No CSCI-UA 201 matches");
    expect(badge.classList.contains("is-empty")).toBe(true);
    expect(comments.getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 1 shown, no CSCI-UA 201 comment matches");
    expect(panel.getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 1 shown, no CSCI-UA 201 comment matches");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, no CSCI-UA 201 comment matches",
    );
  });

  it("matches useful comments when Albert pads CS201 course numbers with a leading zero", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 0201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Systems-specific comment for CS201.",
          course: "CSCI-UA 201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course CSCI-UA 201 (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("matches useful comments when Albert uses dotted CS201 catalog notation", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA.0201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Dotted Albert catalog notation should still match CS201.",
          course: "CSCI-UA 201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course CSCI-UA 201 (Albert match)");
    expect(document.querySelector(".nyu-rmp-course-context").textContent.replace(/\s+/g, " ").trim()).toBe("Albert CSCI-UA 201");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("matches useful comments when RMP omits punctuation in CS201 course metadata", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Compact course metadata should still match CS201.",
          course: "CSCIUA201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course CSCIUA201 (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("matches useful comments when RMP labels CS201 by course title", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Course-title metadata should still match the CS201 Albert row.",
          course: "Computer Systems Organization",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course Computer Systems Organization (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("matches useful comments when RMP labels CS201 by singular course title", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Singular course-title metadata should still match the CS201 Albert row.",
          course: "Computer System Organization",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course Computer System Organization (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("matches useful comments when RMP abbreviates the CS201 course title as org", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "The projects are tightly coupled to the lecture material.",
          course: "Computer Systems Org",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course Computer Systems Org (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
  });

  it("promotes useful comments that mention CS201 when RMP omits course metadata", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Generic useful comment should be shown after course-specific context.",
          course: "CSCI-UA 102",
          helpfulRating: 24,
        },
        {
          text: "CS201 projects are demanding but the systems labs are practical.",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const comments = Array.from(document.querySelectorAll(".nyu-rmp-comment-text")).map((node) => node.textContent);
    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(comments[0]).toBe("CS201 projects are demanding but the systems labs are practical.");
    expect(metadata.textContent).toContain("Albert course match");
    expect(metadata.classList.contains("is-course-match")).toBe(true);
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "2 useful comments shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("promotes useful comments that mention the CS201 course title without metadata", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Computer System Organization requires steady lab work.",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Albert course match");
    expect(metadata.classList.contains("is-course-match")).toBe(true);
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
  });

  it("promotes useful comments that mention the CSO shorthand without metadata", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        { text: "Generic advice for another class.", helpfulRating: 50 },
        { text: "CSO labs move fast and the exams are systems-heavy.", helpfulRating: 3 },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const comments = Array.from(document.querySelectorAll(".nyu-rmp-comment-text")).map((node) => node.textContent);
    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(comments[0]).toBe("CSO labs move fast and the exams are systems-heavy.");
    expect(metadata.textContent).toContain("Albert course match");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
  });

  it("promotes useful comments that mention the Operating Systems course title without metadata", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 202 Operating Systems</td>
            <td>Instructor: Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.1,
      difficulty: 3.1,
      ratingsCount: 44,
      tags: [],
      topComments: [
        { text: "Generic advice for another CS class.", helpfulRating: 50 },
        { text: "Operating Systems projects are clear and starter code helps.", helpfulRating: 3 },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const comments = Array.from(document.querySelectorAll(".nyu-rmp-comment-text")).map((node) => node.textContent);
    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(comments[0]).toBe("Operating Systems projects are clear and starter code helps.");
    expect(metadata.textContent).toContain("Albert course match");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 202 match");
    expect(Array.from(document.querySelectorAll(".nyu-rmp-evidence-chip")).map((node) => node.textContent)).toContain("CSCI-UA 202 comment support 100/100");
  });

  it("matches useful comments when RMP spaces CS201 course metadata", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Spaced course metadata should still match CS201.",
          course: "CSCI UA 201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course CSCI UA 201 (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("matches useful comments when RMP hyphenates the CS201 course number", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Hyphenated course-number metadata should still match CS201.",
          course: "CSCI-UA-201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course CSCI-UA-201 (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("matches useful comments when RMP abbreviates CS201 course metadata", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "CS shorthand metadata should still match the Albert CS201 row.",
          course: "CS 201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course CS 201 (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("matches useful comments when RMP omits the NYU UA school code from CS201 metadata", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "CSCI-only course metadata should still match the Albert CS201 row.",
          course: "CSCI 201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course CSCI 201 (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("matches useful comments when Albert omits punctuation in CS201 course text", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCIUA201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Standard RMP course metadata should match compact Albert text.",
          course: "CSCI-UA 201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const metadata = document.querySelector(".nyu-rmp-comment-meta");
    expect(metadata.textContent).toContain("Course CSCI-UA 201 (Albert match)");
    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "1 useful comment shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("shows Albert course-matched useful comments before generic comments", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Generic high-helpfulness comment about another section.",
          course: "CSCI-UA 102",
          helpfulRating: 44,
        },
        {
          text: "Systems-specific comment for CS201.",
          course: "CSCI-UA 201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const comments = Array.from(document.querySelectorAll(".nyu-rmp-comment-text")).map((comment) => comment.textContent);
    expect(comments).toEqual([
      "Systems-specific comment for CS201.",
      "Generic high-helpfulness comment about another section.",
    ]);
  });

  it("renders only three useful comments after promoting Albert course matches", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.1,
      ratingsCount: 92,
      tags: [],
      topComments: [
        { text: "Most useful generic comment.", course: "CSCI-UA 102", helpfulRating: 50 },
        { text: "Second generic comment.", helpfulRating: 40 },
        { text: "Third generic comment.", helpfulRating: 30 },
        { text: "Fourth generic comment should stay hidden.", helpfulRating: 20 },
        { text: "Later CS201-specific context should be promoted.", course: "CSCI-UA 201", helpfulRating: 4 },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const comments = Array.from(document.querySelectorAll(".nyu-rmp-comments li:not([hidden]) .nyu-rmp-comment-text")).map((comment) => comment.textContent);
    expect(comments).toEqual([
      "Later CS201-specific context should be promoted.",
      "Most useful generic comment.",
      "Second generic comment.",
    ]);
    expect(Array.from(document.querySelectorAll(".nyu-rmp-comments li[hidden] .nyu-rmp-comment-text")).map((comment) => comment.textContent)).toEqual([
      "Third generic comment.",
      "Fourth generic comment should stay hidden.",
    ]);
    expect(document.querySelector(".nyu-rmp-comments-heading").childNodes[0].textContent).toBe("Most useful comments (3)");
    expect(document.querySelector(".nyu-rmp-comments-truncated").textContent).toBe("Showing 3 of 5 useful comments");
    expect(document.querySelector(".nyu-rmp-comments-expand").textContent).toBe("Show 2 more comments");
    expect(document.querySelector(".nyu-rmp-comments-panel").getAttribute("aria-label")).toContain("3 of 5 useful comments shown");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "3 useful comments shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("lets students reveal hidden useful comments without leaving Albert", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.3,
      difficulty: 2.7,
      ratingsCount: 44,
      tags: [],
      topComments: [
        "Most useful comment.",
        "Second useful comment.",
        "Third useful comment.",
        "Fourth useful comment should be revealable.",
        "Fifth useful comment should be revealable.",
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const list = document.querySelector(".nyu-rmp-comments");
    const hiddenComments = Array.from(document.querySelectorAll(".nyu-rmp-comment.is-hidden"));
    const toggle = document.querySelector(".nyu-rmp-comments-expand");

    expect(list.getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 3 of 5 useful comments shown");
    expect(hiddenComments).toHaveLength(2);
    expect(hiddenComments.every((comment) => comment.hidden)).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.textContent).toBe("Show 2 more comments");

    toggle.click();

    expect(hiddenComments.every((comment) => comment.hidden)).toBe(false);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.textContent).toBe("Show fewer comments");
    expect(list.getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 5 of 5 useful comments shown");
  });

  it("updates the card summary when hidden useful comments are expanded", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.3,
      difficulty: 2.7,
      ratingsCount: 44,
      tags: [],
      topComments: [
        "Most useful comment.",
        "Second useful comment.",
        "Third useful comment.",
        "Fourth useful comment should be revealable.",
        "Fifth useful comment should be revealable.",
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const card = document.querySelector(".nyu-rmp-card");
    const toggle = document.querySelector(".nyu-rmp-comments-expand");

    expect(card.getAttribute("aria-label")).toContain("3 useful comments shown");

    toggle.click();

    expect(card.getAttribute("aria-label")).toContain("5 useful comments shown");

    toggle.click();

    expect(card.getAttribute("aria-label")).toContain("3 useful comments shown");
  });

  it("updates the visible comments heading when hidden useful comments are expanded", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.3,
      difficulty: 2.7,
      ratingsCount: 44,
      tags: [],
      topComments: [
        "Most useful comment.",
        "Second useful comment.",
        "Third useful comment.",
        "Fourth useful comment should be revealable.",
        "Fifth useful comment should be revealable.",
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const heading = document.querySelector(".nyu-rmp-comments-heading");
    const toggle = document.querySelector(".nyu-rmp-comments-expand");

    expect(heading.childNodes[0].textContent).toBe("Most useful comments (3)");

    toggle.click();

    expect(heading.childNodes[0].textContent).toBe("Most useful comments (5)");

    toggle.click();

    expect(heading.childNodes[0].textContent).toBe("Most useful comments (3)");
  });

  it("counts hidden Albert course-matched useful comments in the CS201 badge", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.9,
      difficulty: 3.1,
      ratingsCount: 92,
      tags: [],
      topComments: [
        { text: "First CS201 comment.", course: "CSCI-UA 201", helpfulRating: 50 },
        { text: "Second CS201 comment.", course: "CSCI-UA 201", helpfulRating: 40 },
        { text: "Third CS201 comment.", course: "CSCI-UA 201", helpfulRating: 30 },
        { text: "Fourth CS201 comment should start hidden.", course: "CSCI-UA 201", helpfulRating: 20 },
        { text: "Generic useful comment.", helpfulRating: 10 },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("4 CSCI-UA 201 matches");
    expect(document.querySelector(".nyu-rmp-comments-panel").getAttribute("aria-label")).toContain(
      "4 useful comments match Albert course CSCI-UA 201",
    );
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "3 useful comments shown, 4 useful comments match Albert course CSCI-UA 201",
    );
    expect(document.querySelector(".nyu-rmp-comment.is-hidden .nyu-rmp-comment-meta").textContent).toContain(
      "Course CSCI-UA 201 (Albert match)",
    );
  });

  it("summarizes Albert course-matched useful comments in the rating card label", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Generic high-helpfulness comment about another section.",
          course: "CSCI-UA 102",
          helpfulRating: 44,
        },
        {
          text: "Systems-specific comment for CS201.",
          course: "CSCI-UA 201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "2 useful comments shown, 1 useful comment matches Albert course CSCI-UA 201",
    );
  });

  it("shows the Albert course-match count in the useful comments panel", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: [
        {
          text: "Generic high-helpfulness comment about another section.",
          course: "CSCI-UA 102",
          helpfulRating: 44,
        },
        {
          text: "Systems-specific comment for CS201.",
          course: "CSCI-UA 201",
          helpfulRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const panel = document.querySelector(".nyu-rmp-comments-panel");
    expect(panel.querySelector(".nyu-rmp-comments-heading").childNodes[0].textContent).toBe("Most useful comments (2)");
    expect(panel.querySelector(".nyu-rmp-comments-course-match").textContent).toBe("1 CSCI-UA 201 match");
    expect(panel.getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 2 shown, 1 useful comment matches Albert course CSCI-UA 201");
  });

  it("labels the useful comments panel as most useful RMP comments", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Explains low-level systems clearly and gives practical labs."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const panel = document.querySelector(".nyu-rmp-comments-panel");
    expect(panel.querySelector(".nyu-rmp-comments-heading").childNodes[0].textContent).toBe("Most useful comments (1)");
    expect(panel.querySelector(".nyu-rmp-comments").getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 1 shown");
  });

  it("shows that useful comments come from the 20-rating RMP sample", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Explains low-level systems clearly and gives practical labs."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const panel = document.querySelector(".nyu-rmp-comments-panel");
    const sample = panel.querySelector(".nyu-rmp-comments-sample");
    expect(sample.textContent).toBe("20-rating sample");
    expect(sample.getAttribute("aria-label")).toBe("Useful comments selected from a 20-rating RMP sample");
    expect(panel.getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 1 shown");
    expect(panel.querySelector(".nyu-rmp-comments").getAttribute("aria-label")).toBe("Most useful RMP comments from a 20-rating sample, 1 shown");
  });

  it("shows how many useful comments are displayed", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [
        "Explains low-level systems clearly and gives practical labs.",
        "Office hours make the systems projects easier to reason about.",
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-comments-heading").childNodes[0].textContent).toBe("Most useful comments (2)");
  });

  it("summarizes displayed useful-comment count in the rating card accessible label", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [
        "Explains low-level systems clearly and gives practical labs.",
        "Office hours make the systems projects easier to reason about.",
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("2 useful comments shown");
  });

  it("shows an explicit empty state when RMP has no useful comments", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const panel = document.querySelector(".nyu-rmp-comments-panel");
    expect(panel.querySelector(".nyu-rmp-comments-heading").childNodes[0].textContent).toBe("Most useful comments");
    expect(panel.querySelector(".nyu-rmp-comments-empty").textContent).toBe("No useful comments found in the 20-rating RMP sample.");
    expect(document.querySelector(".nyu-rmp-comments")).toBeNull();
  });

  it("does not render placeholder cached RMP comments", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [
        { text: "N/A.", helpfulRating: 40 },
        "No comments.",
        { text: "---", helpfulRating: 24 },
        { text: "No comments yet", helpfulRating: 20 },
        { text: "Lectures are clear and the systems projects are fair.", helpfulRating: 12 },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const commentTexts = Array.from(document.querySelectorAll(".nyu-rmp-comment-text")).map((comment) => comment.textContent);
    expect(commentTexts).toEqual(["Lectures are clear and the systems projects are fair."]);
    expect(document.body.textContent).not.toContain("N/A.");
    expect(document.body.textContent).not.toContain("No comments.");
    expect(document.body.textContent).not.toContain("---");
    expect(document.body.textContent).not.toContain("No comments yet");
  });

  it("decodes and spaces cached RMP comments before rendering them", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [
        { text: "Projects&nbsp;&amp;\n\nlabs are fair &#39;if&#39; you start early.", helpfulRating: 12 },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-comment-text").textContent).toBe(
      "Projects & labs are fair 'if' you start early.",
    );
    expect(document.body.textContent).not.toContain("&amp;");
    expect(document.body.textContent).not.toContain("&#39;");
  });

  it("decodes cached smart quote and dash entities before rendering comments", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [
        { text: "Don&rsquo;t skip labs &mdash; they&rsquo;re exam prep.", helpfulRating: 12 },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-comment-text").textContent).toBe(
      "Don't skip labs - they're exam prep.",
    );
    expect(document.body.textContent).not.toContain("&rsquo;");
    expect(document.body.textContent).not.toContain("&mdash;");
  });

  it("decodes cached ellipsis and mark entities before rendering comments", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [
        { text: "Labs use Linux&reg;&hellip; read the docs&trade;.", helpfulRating: 12 },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-comment-text").textContent).toBe(
      "Labs use Linux(R)... read the docs(TM).",
    );
    expect(document.body.textContent).not.toContain("&hellip;");
    expect(document.body.textContent).not.toContain("&trade;");
  });

  it("renders only trimmed nonblank cached RMP tags", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: ["  Clear grading criteria ", "   ", "", null],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const tags = Array.from(document.querySelectorAll(".nyu-rmp-tags span")).map((tag) => tag.textContent);
    expect(tags).toEqual(["Clear grading criteria"]);
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("tags Clear grading criteria");
  });

  it("does not render unsafe cached RMP profile URLs", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "javascript:alert(1)",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const profileLink = document.querySelector(".nyu-rmp-actions a");
    expect(profileLink.textContent).toBe("Search RMP");
    expect(profileLink.getAttribute("href")).toBe("https://www.ratemyprofessors.com/search/professors/1381?q=Ada%20Lovelace");
    expect(profileLink.getAttribute("aria-label")).toBe("Search RMP for Ada Lovelace");
  });

  it("labels matched RMP profile links with the professor name", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const profileLink = document.querySelector(".nyu-rmp-actions a");
    expect(profileLink.textContent).toBe("RMP");
    expect(profileLink.getAttribute("aria-label")).toBe("Open RMP profile for Ada Lovelace");
    expect(profileLink.getAttribute("rel")).toBe("noreferrer noopener");
  });

  it("labels rating card action groups with the professor name", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const actions = document.querySelector(".nyu-rmp-actions");
    expect(actions.getAttribute("aria-label")).toBe("RMP actions for Ada Lovelace");
    expect(actions.querySelector(".nyu-rmp-refresh").getAttribute("aria-label")).toBe("Refresh RMP rating for Ada Lovelace");
    expect(actions.querySelector("a").getAttribute("aria-label")).toBe("Open RMP profile for Ada Lovelace");
  });

  it("omits negative useful-comment metadata from cached RMP ratings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [
        {
          text: "Cached comment with malformed metadata.",
          helpfulRating: -1,
          clarityRating: -1,
          difficultyRating: -1,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.body.textContent).toContain("Cached comment with malformed metadata.");
    expect(document.querySelector(".nyu-rmp-comment-meta")).toBeNull();
    expect(document.body.textContent).not.toContain("-1 useful");
    expect(document.body.textContent).not.toContain("Clarity -1.0");
    expect(document.body.textContent).not.toContain("Difficulty -1.0");
  });

  it("renders a singular rating count label for one RMP rating", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 1,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-score-row").textContent).toContain("1 rating");
    expect(document.querySelector(".nyu-rmp-score-row").textContent).not.toContain("1 ratings");
  });

  it("renders negative cached rating counts as zero ratings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: -1,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("0 ratings");
    expect(scoreRowText).not.toContain("-1 ratings");
  });

  it("renders fractional cached rating counts as whole ratings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 12.8,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("12 ratings");
    expect(scoreRowText).not.toContain("12.8 ratings");
  });

  it("renders comma-formatted cached rating counts", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: "1,234",
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("1234 ratings");
  });

  it("renders labeled comma-formatted cached rating counts", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: "1,234 ratings",
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("1234 ratings");
  });

  it("renders abbreviated cached rating counts", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: "1.2k ratings",
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("1200 ratings");
  });

  it("renders negative cached RMP metrics as unavailable values", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: -1,
      difficulty: -1,
      ratingsCount: 12,
      wouldTakeAgain: -1,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("N/A");
    expect(scoreRowText).toContain("No rating");
    expect(scoreRowText).toContain("Difficulty N/A");
    expect(scoreRowText).not.toContain("-1.0");
    expect(scoreRowText).not.toContain("-1% take again");
  });

  it("does not render cached RMP take-again percentages above 100", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 12,
      wouldTakeAgain: 125,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).not.toContain("125% take again");
  });

  it("renders formatted cached RMP take-again percentages", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 12,
      wouldTakeAgain: "82%",
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(scoreRowText).toContain("82% take again");
  });

  it("renders cached RMP scale metrics above 5 as unavailable values", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 6.2,
      difficulty: 8.4,
      ratingsCount: 12,
      tags: [],
      topComments: [
        {
          text: "Cached comment with impossible metadata.",
          clarityRating: 7,
          difficultyRating: 8,
        },
      ],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("N/A");
    expect(scoreRowText).toContain("Difficulty N/A");
    expect(document.body.textContent).not.toContain("6.2");
    expect(document.body.textContent).not.toContain("Difficulty 8.4");
    expect(document.querySelector(".nyu-rmp-comment-meta")).toBeNull();
  });

  it("renders formatted cached RMP rating strings", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: "4.7 / 5",
      difficulty: "2.4 / 5",
      ratingsCount: 12,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const scoreRowText = document.querySelector(".nyu-rmp-score-row").textContent;
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("4.7");
    expect(scoreRowText).toContain("Difficulty 2.4");
  });

  it("keeps long useful comments compact until expanded", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const longComment = [
      "This professor gives detailed systems lectures with careful examples, but the project workload is heavy",
      "and the exams require students to understand every lab at a deep level before test day.",
    ].join(" ");
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.8,
      ratingsCount: 44,
      tags: [],
      topComments: [{ text: longComment, helpfulRating: 18 }],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const commentText = document.querySelector(".nyu-rmp-comment-text");
    const toggle = document.querySelector(".nyu-rmp-comment-toggle");
    expect(commentText.textContent).not.toBe(longComment);
    expect(commentText.textContent.endsWith("...")).toBe(true);
    expect(toggle.textContent).toBe("Show more");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(commentText.id);
    expect(commentText.id).toMatch(/^nyu-rmp-comment-/);

    toggle.click();

    expect(commentText.textContent).toBe(longComment);
    expect(toggle.textContent).toBe("Show less");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("renders when the RMP data was last updated", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      topComments: [],
      cacheUpdatedAt: new Date("2026-05-24T12:00:00Z").getTime(),
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-updated").textContent).toBe("Updated May 24, 2026");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain("Updated May 24, 2026");
  });

  it("shows a cached-data notice when a stale RMP refresh failed", async () => {
    document.body.innerHTML = `<div>Instructor: Alan Turing</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 3.1,
      difficulty: 3.8,
      ratingsCount: 18,
      topComments: ["Older cached comment shown during RMP outage."],
      cacheUpdatedAt: new Date("2026-05-17T12:00:00Z").getTime(),
      cacheStatus: "stale-refresh-failed",
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const notice = document.querySelector(".nyu-rmp-cache-note");
    expect(notice.getAttribute("role")).toBe("note");
    expect(notice.textContent).toBe("Showing cached RMP data; refresh failed.");
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "Showing cached RMP data; refresh failed",
    );
  });

  it("shows the original Albert instructor name when the RMP match name differs", async () => {
    document.body.innerHTML = `<div>Instructor: Chee Keng Yap</div>`;
    const lookupProfessor = vi.fn(async () => ({
      name: "Chee Yap",
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      matchConfidence: "fuzzy",
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-detail-meta > strong").textContent).toBe("Chee Yap");
    expect(document.querySelector(".nyu-rmp-match-note").textContent).toBe(
      "Fuzzy RMP match - Albert: Chee Keng Yap",
    );
    expect(document.querySelector(".nyu-rmp-card").getAttribute("aria-label")).toContain(
      "Fuzzy RMP match - Albert: Chee Keng Yap",
    );
  });

  it("keeps a manual RMP search fallback when the automatic match is fuzzy", async () => {
    document.body.innerHTML = `<div>Instructor: Chee Keng Yap</div>`;
    const lookupProfessor = vi.fn(async () => ({
      name: "Chee Yap",
      department: "Computer Science",
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      matchConfidence: "fuzzy",
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const actions = document.querySelector(".nyu-rmp-actions");
    const links = Array.from(actions.querySelectorAll("a"));
    const profileLink = links.find((link) => link.textContent === "RMP");
    const searchLink = links.find((link) => link.textContent === "Search RMP");

    expect(profileLink.getAttribute("aria-label")).toBe("Open RMP profile for Chee Yap");
    expect(profileLink.href).toBe("https://www.ratemyprofessors.com/professor/419998");
    expect(searchLink.href).toBe("https://www.ratemyprofessors.com/search/professors/1381?q=Chee%20Keng%20Yap");
    expect(searchLink.getAttribute("aria-label")).toBe("Search RMP for Chee Keng Yap");
    expect(searchLink.getAttribute("rel")).toBe("noreferrer noopener");
  });

  it("refreshes a professor card with a cache-bypassing lookup", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn()
      .mockResolvedValueOnce({
        name: "Ada Lovelace",
        department: "Computer Science",
        rating: 4.7,
        difficulty: 2.4,
        ratingsCount: 38,
        wouldTakeAgain: 92,
        tags: [],
        topComments: ["Original comment."],
        url: "https://www.ratemyprofessors.com/professor/123",
      })
      .mockResolvedValueOnce({
        name: "Ada Lovelace",
        department: "Computer Science",
        rating: 3.1,
        difficulty: 3.8,
        ratingsCount: 41,
        wouldTakeAgain: 62,
        tags: [],
        topComments: ["Fresh comment."],
        url: "https://www.ratemyprofessors.com/professor/123",
      });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.querySelector(".nyu-rmp-refresh").click();
    await flushPromises();

    expect(lookupProfessor).toHaveBeenLastCalledWith("Ada Lovelace", { forceRefresh: true });
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("3.1");
    expect(document.body.textContent).toContain("Fresh comment.");
  });

  it("renders partial RMP payloads without turning the card into an error", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => ({
      name: "Ada Lovelace",
      rating: null,
      difficulty: null,
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-card").classList.contains("is-error")).toBe(false);
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("N/A");
    expect(document.querySelector(".nyu-rmp-score").getAttribute("aria-label")).toBe("RMP rating unavailable");
    expect(document.body.textContent).toContain("No rating");
    expect(document.body.textContent).toContain("N/A ratings");
    expect(document.body.textContent).toContain("Difficulty N/A");
    const fallbackLink = document.querySelector(".nyu-rmp-card a");
    expect(fallbackLink.textContent).toBe("Search RMP");
    expect(fallbackLink.href).toBe("https://www.ratemyprofessors.com/search/professors/1381?q=Ada%20Lovelace");
  });

  it("uses an RMP professor search action when a matched result has no profile URL", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => ({
      name: "Ada Lovelace",
      department: "Computer Science",
      rating: 4.2,
      difficulty: 3.1,
      ratingsCount: 12,
      topComments: [],
      url: "",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const actions = document.querySelector(".nyu-rmp-actions");
    const links = Array.from(actions.querySelectorAll("a"));
    expect(links).toHaveLength(1);
    expect(links[0].textContent).toBe("Search RMP");
    expect(links[0].href).toBe("https://www.ratemyprofessors.com/search/professors/1381?q=Ada%20Lovelace");
    expect(links[0].getAttribute("aria-label")).toBe("Search RMP for Ada Lovelace");
  });

  it("lets students refresh a no-match card without rescanning Albert", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        name: "Ada Lovelace",
        department: "Computer Science",
        rating: 4.7,
        difficulty: 2.4,
        ratingsCount: 38,
        wouldTakeAgain: 92,
        tags: [],
        topComments: ["Now found."],
        url: "https://www.ratemyprofessors.com/professor/123",
      });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.querySelector(".nyu-rmp-refresh").click();
    await flushPromises();

    expect(lookupProfessor).toHaveBeenLastCalledWith("Ada Lovelace", { forceRefresh: true });
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("4.7");
    expect(document.body.textContent).toContain("Now found.");
  });

  it("links no-match cards to an RMP professor search for the requested name", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const actions = document.querySelector(".nyu-rmp-actions");
    const searchLink = document.querySelector(".nyu-rmp-search");
    const emptyNote = document.querySelector(".nyu-rmp-empty-note");
    expect(actions.getAttribute("aria-label")).toBe("RMP actions for Ada Lovelace");
    expect(searchLink.textContent).toBe("Search RMP");
    expect(searchLink.href).toBe("https://www.ratemyprofessors.com/search/professors/1381?q=Ada%20Lovelace");
    expect(searchLink.getAttribute("aria-label")).toBe("Search RMP for Ada Lovelace");
    expect(searchLink.getAttribute("rel")).toBe("noreferrer noopener");
    expect(emptyNote.getAttribute("role")).toBe("note");
    expect(emptyNote.textContent).toBe("No automatic RMP match. Use Search RMP to verify manually.");
  });

  it("announces loading, no-match, and error status updates politely", async () => {
    document.body.innerHTML = `
      <div>Instructor: Ada Lovelace</div>
      <div>Instructor: Grace Hopper</div>
      <div>Instructor: Alan Turing</div>
    `;
    const lookupProfessor = vi.fn((name) => {
      if (name === "Ada Lovelace") {
        return new Promise(() => {});
      }
      if (name === "Grace Hopper") {
        return Promise.resolve(null);
      }
      return Promise.reject(new Error("RMP lookup failed"));
    });

    scanAlbertPageOnce({ document, lookupProfessor });
    await flushPromises();

    const statuses = Array.from(document.querySelectorAll(".nyu-rmp-status"));
    expect(statuses.map((status) => status.getAttribute("role"))).toEqual(["status", "status", "status"]);
    expect(statuses.map((status) => status.getAttribute("aria-live"))).toEqual(["polite", "polite", "polite"]);
    expect(statuses.map((status) => status.getAttribute("aria-atomic"))).toEqual(["true", "true", "true"]);
  });

  it("lets students retry an error card after a failed RMP request", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn()
      .mockRejectedValueOnce(new Error("RMP lookup failed"))
      .mockResolvedValueOnce({
        name: "Ada Lovelace",
        department: "Computer Science",
        rating: 4.7,
        difficulty: 2.4,
        ratingsCount: 38,
        wouldTakeAgain: 92,
        tags: [],
        topComments: ["Recovered."],
        url: "https://www.ratemyprofessors.com/professor/123",
      });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.querySelector(".nyu-rmp-refresh").click();
    await flushPromises();

    expect(lookupProfessor).toHaveBeenLastCalledWith("Ada Lovelace", { forceRefresh: true });
    expect(document.querySelector(".nyu-rmp-score").textContent).toBe("4.7");
    expect(document.body.textContent).toContain("Recovered.");
  });

  it("links error cards to an RMP professor search for manual fallback", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => {
      throw new Error("RMP lookup failed");
    });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const actions = document.querySelector(".nyu-rmp-actions");
    const searchLink = document.querySelector(".nyu-rmp-search");
    expect(actions.getAttribute("aria-label")).toBe("RMP actions for Ada Lovelace");
    expect(searchLink.textContent).toBe("Search RMP");
    expect(searchLink.href).toBe("https://www.ratemyprofessors.com/search/professors/1381?q=Ada%20Lovelace");
    expect(searchLink.getAttribute("aria-label")).toBe("Search RMP for Ada Lovelace");
    expect(searchLink.getAttribute("rel")).toBe("noreferrer noopener");
  });

  it("labels refresh controls with the requested professor name", async () => {
    document.body.innerHTML = `
      <div>Instructor: Ada Lovelace</div>
      <div>Instructor: Grace Hopper</div>
      <div>Instructor: Alan Turing</div>
    `;
    const lookupProfessor = vi.fn(async (name) => {
      if (name === "Ada Lovelace") {
        return {
          name,
          rating: 4.7,
          difficulty: 2.4,
          ratingsCount: 38,
          tags: [],
          topComments: [],
          url: "https://www.ratemyprofessors.com/professor/123",
        };
      }
      if (name === "Grace Hopper") {
        return null;
      }
      throw new Error("RMP lookup failed");
    });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const labels = Array.from(document.querySelectorAll(".nyu-rmp-refresh"))
      .map((button) => button.getAttribute("aria-label"));
    expect(labels).toEqual([
      "Refresh RMP rating for Ada Lovelace",
      "Refresh RMP rating for Grace Hopper",
      "Retry RMP rating for Alan Turing",
    ]);
  });

  it("does not duplicate cards when Albert mutates the same processed row", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(lookupProfessor).toHaveBeenCalledTimes(1);
  });

  it("marks injected rating roots and cards with the extension version", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelector(".nyu-rmp-rating-root").dataset.nyuRmpVersion).toBe("0.1.2");
    expect(document.querySelector(".nyu-rmp-card").dataset.nyuRmpVersion).toBe("0.1.2");
  });

  it("ignores hidden Albert instructor templates during scans", async () => {
    document.body.innerHTML = `
      <div hidden>Instructor: Hidden Template</div>
      <div aria-hidden="true">Instructor: Hidden Aria</div>
      <div aria-hidden="TRUE">Instructor: Hidden Aria Uppercase</div>
      <div aria-hidden=" true ">Instructor: Hidden Aria Spaced</div>
      <div inert>Instructor: Hidden Inert</div>
      <div style="content-visibility: hidden;">Instructor: Hidden Content Visibility</div>
      <div style="display: none;">Instructor: Hidden Display</div>
      <div style="opacity: 0;">Instructor: Hidden Transparent</div>
      <div style="opacity: 0.0;">Instructor: Hidden Transparent Variant</div>
      <div style="height: 0; width: 0; overflow: hidden;">Instructor: Hidden Zero Size</div>
      <div>Instructor: Ada Lovelace</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Hidden Aria Uppercase");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Hidden Aria Spaced");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Hidden Inert");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Hidden Content Visibility");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("ignores mixed Albert placeholder instructor text", async () => {
    document.body.innerHTML = `
      <div>Instructor: Staff TBA</div>
      <div>Instructor: Staff - TBA</div>
      <div>Instructor: Department - TBD</div>
      <div>Instructor: Pending - Assignment</div>
      <div>Instructor: To Be Assigned</div>
      <div>Instructor: Not Available</div>
      <div>Instructor: Not Yet Assigned</div>
      <div>Instructor: Pending Assignment</div>
      <div>Instructor: Department TBD</div>
      <div>Instructor: No Faculty Assigned</div>
      <div>Instructor: Department Contact</div>
      <div>Instructor: Contact Department</div>
      <div>Instructor: Ask Department</div>
      <div>Instructor: See Advisor</div>
      <div>Instructor: Online Course</div>
      <div>Instructor: Multiple Instructors</div>
      <div>Instructor: Various Instructors</div>
      <div>Instructor: To Be Named</div>
      <div>Instructor: See Department</div>
      <div>Instructor: Staff (TBA)</div>
      <div>Instructor: Ada Lovelace (Staff)</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Staff Tba");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Staff - Tba");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Department - Tbd");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Pending - Assignment");
    expect(lookupProfessor).not.toHaveBeenCalledWith("To Be Assigned");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Not Available");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Not Yet Assigned");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Pending Assignment");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Department Tbd");
    expect(lookupProfessor).not.toHaveBeenCalledWith("No Faculty Assigned");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Department Contact");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Contact Department");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Ask Department");
    expect(lookupProfessor).not.toHaveBeenCalledWith("See Advisor");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Online Course");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Multiple Instructors");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Various Instructors");
    expect(lookupProfessor).not.toHaveBeenCalledWith("To Be Named");
    expect(lookupProfessor).not.toHaveBeenCalledWith("See Department");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Staff (tba)");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Ada Lovelace (staff)");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("ignores comma-separated placeholder instructors without corrupting real names", async () => {
    document.body.innerHTML = `
      <div>Instructor(s): TBA, Ada Lovelace</div>
      <div>Instructor: Grace Hopper, Staff</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(2);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace Hopper");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Ada Lovelace Tba");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Staff Grace Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("ignores instructor sections hidden by Albert stylesheet classes", async () => {
    document.head.innerHTML = `<style>.collapsed-albert-section { display: none; }</style>`;
    document.body.innerHTML = `
      <div class="collapsed-albert-section">Instructor: Hidden Stylesheet</div>
      <div>Instructor: Grace Hopper</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Grace Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("removes injected cards and processed markers when the overlay is disabled", async () => {
    document.body.innerHTML = `<div id="instructor">Instructor: Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.getElementById("instructor").dataset.nyuRmpProcessed).toBe("true");

    removeAlbertRmpEnhancements(document);

    expect(document.querySelector(".nyu-rmp-rating-root")).toBeNull();
    expect(document.getElementById("instructor").dataset.nyuRmpProcessed).toBeUndefined();
  });

  it("reuses one RMP lookup for duplicate instructors during the same scan", async () => {
    document.body.innerHTML = `
      <div>Instructor: Ada Lovelace</div>
      <div>Instructor: Ada Lovelace</div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Clear systems explanations."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(Array.from(document.querySelectorAll(".nyu-rmp-score")).map((score) => score.textContent)).toEqual([
      "4.7",
      "4.7",
    ]);
  });

  it("reuses one RMP lookup for accented and unaccented duplicate instructors during the same scan", async () => {
    document.body.innerHTML = `
      <div>Instructor: Jos\u00e9 Garc\u00eda</div>
      <div>Instructor: Jose Garcia</div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Accent folded duplicate lookup."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Jos\u00e9 Garc\u00eda");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("deduplicates repeated instructor names inside the same Albert instructor cell", async () => {
    document.body.innerHTML = `<div>Instructor(s): Ada Lovelace; Ada Lovelace</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Clear systems explanations."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("deduplicates repeated instructor names inside adjacent Albert cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor(s)</th>
            <td>Ada Lovelace; Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Clear systems explanations."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("injects ratings when Albert splits the instructor label and name into adjacent cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      wouldTakeAgain: 24.2857,
      tags: [],
      topComments: ["Assignments are demanding."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Assignments are demanding.");
  });

  it("injects ratings when Albert splits a primary instructor label and name into adjacent cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Primary Instructor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Primary instructor labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Primary instructor labels should render.");
  });

  it("injects ratings when adjacent Albert instructor labels include a trailing colon", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor(s):</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Assignments are demanding."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("injects ratings when adjacent Albert instructor labels include a trailing period", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor.</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Period-terminated labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Period-terminated labels should render.");
  });

  it("injects ratings when adjacent Albert instructor labels include trailing dash separators", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor -</th>
            <td>YAP, CHEE KENG</td>
          </tr>
          <tr>
            <th>Instructor(s) \u2013</th>
            <td>Grace B. Hopper</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.4,
      ratingsCount: 17,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("skips empty spacer cells between adjacent Albert instructor labels and names", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td class="spacer"></td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Spacer cells should not block instructor detection."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Spacer cells should not block instructor detection.");
  });

  it("skips separator-only cells between adjacent Albert instructor labels and names", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>:</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Separator cells should not block instructor detection."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Separator cells should not block instructor detection.");
  });

  it("injects ratings when Albert instructor labels use a hyphen separator", async () => {
    document.body.innerHTML = `<div>Instructor - YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Hyphen-separated labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Hyphen-separated labels should render.");
  });

  it("injects ratings when Albert instructor labels use whitespace instead of punctuation", async () => {
    document.body.innerHTML = `<div>Instructor(s) YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Whitespace-separated labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Whitespace-separated labels should render.");
  });

  it("injects ratings when Albert renders an inline label before name text", async () => {
    document.body.innerHTML = `<div><strong>Instructor</strong>YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Inline label markup should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Inline label markup should render.");
  });

  it("injects ratings when Albert rows use instructor-name labels", async () => {
    document.body.innerHTML = `<div>Instructor Name: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Instructor-name labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Instructor-name labels should render.");
  });

  it("injects ratings when Albert rows use plural instructor-name labels", async () => {
    document.body.innerHTML = `<div>Instructor(s) Name: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Plural instructor-name labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Plural instructor-name labels should render.");
  });

  it("injects ratings when Albert rows use instructor-names labels", async () => {
    document.body.innerHTML = `<div>Instructor Names: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Instructor-names labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Instructor-names labels should render.");
  });

  it("injects ratings when Albert rows use professor labels", async () => {
    document.body.innerHTML = `<div>Professor: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Professor labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Professor labels should render.");
  });

  it("injects ratings when Albert rows use professor-name labels", async () => {
    document.body.innerHTML = `<div>Professor Name: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.5,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: [`${name} professor-name label comment`],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Chee Keng Yap professor-name label comment");
  });

  it("injects ratings when Albert splits a professor label and name into adjacent cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Professor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Adjacent professor labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Adjacent professor labels should render.");
  });

  it("injects ratings when Albert splits a professor-name label and name into adjacent cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Professor Name</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.5,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Adjacent professor-name labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Adjacent professor-name labels should render.");
  });

  it("injects ratings when Albert rows use faculty labels", async () => {
    document.body.innerHTML = `<div>Faculty: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Faculty labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Faculty labels should render.");
  });

  it("injects ratings when Albert rows use teacher labels", async () => {
    document.body.innerHTML = `<div>Teacher: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Teacher labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Teacher labels should render.");
  });

  it("injects ratings when Albert rows use taught-by labels", async () => {
    document.body.innerHTML = `<div>Taught by: YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Taught-by labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Taught-by labels should render.");
  });

  it("does not treat whitespace instructor metadata as a professor name", async () => {
    document.body.innerHTML = `<div>Instructor Consent Required</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("does not treat whitespace professor metadata as a professor name", async () => {
    document.body.innerHTML = `<div>Professor Consent Required</div>`;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("does not treat whitespace faculty metadata as a professor name", async () => {
    document.body.innerHTML = `
      <div>Faculty Consent Required</div>
      <div>Faculty Permission Required</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("does not treat punctuation instructor metadata as a professor name", async () => {
    document.body.innerHTML = `
      <div>Instructor: Permission Required</div>
      <div>Teacher: Permission Required</div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).not.toHaveBeenCalled();
    expect(document.querySelector(".nyu-rmp-card")).toBeNull();
  });

  it("injects ratings when Albert instructor labels use a period separator", async () => {
    document.body.innerHTML = `<div>Instructor. YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Period-separated labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Period-separated labels should render.");
  });

  it("injects ratings when Albert instructor labels use a dash variant separator", async () => {
    document.body.innerHTML = `<div>Instructor \u2013 YAP, CHEE KENG</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Dash-variant labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Dash-variant labels should render.");
  });

  it("strips sentence-final punctuation from Albert instructor names", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace.</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Sentence punctuation should not affect lookup."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Ada Lovelace.");
    expect(document.body.textContent).toContain("Sentence punctuation should not affect lookup.");
  });

  it("strips trailing role annotations from Albert instructor names", async () => {
    document.body.innerHTML = `<div>Instructor: Ada Lovelace - Primary</div>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      tags: [],
      topComments: ["Role annotations should not affect lookup."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Ada Lovelace - Primary");
    expect(document.body.textContent).toContain("Role annotations should not affect lookup.");
  });

  it("injects ratings when Albert uses definition-list instructor labels", async () => {
    document.body.innerHTML = `
      <dl>
        <dt>Instructor</dt>
        <dd>YAP, CHEE KENG</dd>
      </dl>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Definition-list details should still render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.querySelector("dd .nyu-rmp-rating-root")).not.toBeNull();
    expect(document.body.textContent).toContain("Definition-list details should still render.");
  });

  it("ignores hidden adjacent instructor-name cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td hidden>HIDDEN, TEMPLATE</td>
          </tr>
          <tr>
            <th>Instructor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("falls back to a visible marked instructor cell when the immediate sibling is hidden", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td hidden>HIDDEN, TEMPLATE</td>
            <td data-instructor-name>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("falls back to a marked instructor cell when earlier visible siblings are metadata", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>Permission Required</td>
            <td data-instructor-name>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("uses marked Albert instructor attributes when the visible cell text is not the name", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td data-instructor-name="YAP, CHEE KENG">View instructor details</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Attribute-backed instructor names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Attribute-backed instructor names should render.");
  });

  it("injects ratings for standalone Albert instructor-name attributes", async () => {
    document.body.innerHTML = `
      <section>
        <span data-instructor-name="YAP, CHEE KENG">View instructor details</span>
      </section>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Standalone marked instructor names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Standalone marked instructor names should render.");
  });

  it("injects ratings when Albert renders instructor text directly in a link", async () => {
    document.body.innerHTML = `<a href="/psc/albert/details">Instructor: YAP, CHEE KENG</a>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Linked instructor names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Linked instructor names should render.");
  });

  it("injects ratings for standalone Albert instructor-name attributes on links", async () => {
    document.body.innerHTML = `<a href="/psc/albert/details" data-instructor-name="YAP, CHEE KENG">View instructor details</a>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Linked instructor attributes should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Linked instructor attributes should render.");
  });

  it("injects ratings when Albert uses label elements for instructor fields", async () => {
    document.body.innerHTML = `
      <label>Instructor</label>
      <span>YAP, CHEE KENG</span>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Label element instructor fields should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Label element instructor fields should render.");
  });

  it("injects ratings when Albert uses bold instructor labels followed by values", async () => {
    document.body.innerHTML = `
      <strong>Instructor</strong>
      <span>YAP, CHEE KENG</span>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Bold instructor labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Bold instructor labels should render.");
  });

  it("injects ratings when Albert uses b instructor labels followed by values", async () => {
    document.body.innerHTML = `
      <b>Instructor</b>
      <span>YAP, CHEE KENG</span>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["B-tag instructor labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("B-tag instructor labels should render.");
  });

  it("injects ratings when Albert renders instructor text directly in a button", async () => {
    document.body.innerHTML = `<button type="button">Instructor: YAP, CHEE KENG</button>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Button instructor text should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Button instructor text should render.");
  });

  it("injects ratings for role-button Albert instructor-name attributes", async () => {
    document.body.innerHTML = `<span role="button" data-instructor-name="YAP, CHEE KENG">View instructor details</span>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Role-button instructor attributes should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Role-button instructor attributes should render.");
  });

  it("injects ratings when Albert uses an input value for instructor names", async () => {
    document.body.innerHTML = `<input aria-label="Instructor" readonly value="YAP, CHEE KENG" />`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Input instructor values should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Input instructor values should render.");
  });

  it("injects ratings when instructor inputs mirror names in data-value", async () => {
    document.body.innerHTML = `<input aria-label="Instructor" readonly value="" data-value="YAP, CHEE KENG" />`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Input data-value instructor names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Input data-value instructor names should render.");
  });

  it("injects ratings when Albert uses data-instructor-name on an input", async () => {
    document.body.innerHTML = `<input data-instructor-name="YAP, CHEE KENG" readonly value="View instructor details" />`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Input instructor attributes should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Input instructor attributes should render.");
  });

  it("injects ratings when Albert uses selected option text for instructor names", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" selected>YAP, CHEE KENG</option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected instructor options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected instructor options should render.");
  });

  it("injects ratings when selected instructor options expose names in data-label", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-label="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option data-label names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option data-label names should render.");
  });

  it("injects ratings when selected instructor options expose names in data-full-text", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-full-text="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option full text names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option full text names should render.");
  });

  it("injects ratings when selected instructor options expose names in data-full-name", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-full-name="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option full name metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option full name metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-fullname", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-fullname="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option fullname metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option fullname metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-displayname", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-displayname="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option displayname metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option displayname metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-tooltip", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-tooltip="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option tooltip names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option tooltip names should render.");
  });

  it("injects ratings when selected instructor options expose names in data-content", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-content="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option content metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option content metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-search", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-search="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option search metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option search metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-option-label", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-option-label="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option option-label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option option-label metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-option-text", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-option-text="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option option-text metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option option-text metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-item-label", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-item-label="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option item-label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option item-label metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-item-text", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-item-text="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option item-text metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option item-text metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-person-name", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-person-name="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option person-name metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option person-name metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-person-label", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-person-label="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option person-label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option person-label metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-person-text", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-person-text="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option person-text metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option person-text metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-faculty-name", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-faculty-name="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option faculty-name metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option faculty-name metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-faculty-label", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-faculty-label="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option faculty-label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option faculty-label metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-faculty-text", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-faculty-text="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option faculty-text metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option faculty-text metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-professor-name", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-professor-name="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option professor-name metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option professor-name metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-professor-label", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-professor-label="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option professor-label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option professor-label metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-professor-text", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-professor-text="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option professor-text metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option professor-text metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-teacher-name", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-teacher-name="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option teacher-name metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option teacher-name metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-teacher-label", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-teacher-label="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option teacher-label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option teacher-label metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-teacher-text", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-teacher-text="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option teacher-text metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option teacher-text metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-instructor-label", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-instructor-label="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option instructor-label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option instructor-label metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-instructor-text", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-instructor-text="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option instructor-text metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option instructor-text metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-selected-label", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-selected-label="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option selected-label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option selected-label metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-selected-text", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-selected-text="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option selected-text metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option selected-text metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-selected-name", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-selected-name="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 3.3,
      difficulty: 3.9,
      ratingsCount: 61,
      tags: [],
      topComments: ["Selected option selected-name metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option selected-name metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-selected-value", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="419998" data-selected-value="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 3.7,
      difficulty: 2.8,
      ratingsCount: 47,
      tags: [],
      topComments: ["Selected option selected-value metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option selected-value metadata should render.");
  });

  it("injects ratings when selected instructor options expose names in data-title", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-title="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option data-title names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option data-title names should render.");
  });

  it("injects ratings when selected instructor options expose names in data-caption", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-caption="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option caption names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option caption names should render.");
  });

  it("injects ratings when selected instructor options expose names in data-description", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor">
        <option value="">Select instructor</option>
        <option value="419998" data-description="YAP, CHEE KENG" selected></option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option description names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option description names should render.");
  });

  it("injects ratings when a selected non-name option precedes the selected instructor", async () => {
    document.body.innerHTML = `
      <select aria-label="Instructor" multiple>
        <option value="staff" selected>Staff</option>
        <option value="419998" selected>YAP, CHEE KENG</option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Later selected instructor options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Later selected instructor options should render.");
  });

  it("injects ratings when input instructor labels are referenced by aria-labelledby", async () => {
    document.body.innerHTML = `
      <span id="instructor-label">Instructor</span>
      <input aria-labelledby="instructor-label" readonly value="YAP, CHEE KENG" />
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Referenced input labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Referenced input labels should render.");
  });

  it("injects ratings when select instructor labels are referenced by aria-labelledby", async () => {
    document.body.innerHTML = `
      <span id="select-instructor-label">Primary Instructor</span>
      <select aria-labelledby="select-instructor-label">
        <option value="419998" selected>YAP, CHEE KENG</option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Referenced select labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Referenced select labels should render.");
  });

  it("injects ratings when input instructor labels use the native for attribute", async () => {
    document.body.innerHTML = `
      <label for="instructor-field">Instructor</label>
      <input id="instructor-field" readonly value="YAP, CHEE KENG" />
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Native input labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Native input labels should render.");
  });

  it("injects ratings when select instructor labels use the native for attribute", async () => {
    document.body.innerHTML = `
      <label for="select-instructor-field">Primary Instructor</label>
      <select id="select-instructor-field">
        <option value="419998" selected>YAP, CHEE KENG</option>
      </select>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Native select labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Native select labels should render.");
  });

  it("injects ratings when Albert uses ARIA combobox controls for instructor values", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor">YAP, CHEE KENG</div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA combobox instructor values should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA combobox instructor values should render.");
  });

  it("injects ratings when ARIA value controls expose instructor names through aria-valuetext", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-valuetext="YAP, CHEE KENG"></div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA value text should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA value text should render.");
  });

  it("injects ratings when ARIA comboboxes point to active instructor options", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-activedescendant="active-instructor"></div>
      <div role="listbox">
        <div id="active-instructor" role="option">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA active descendant should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA active descendant should render.");
  });

  it("injects ratings when active instructor options expose names in aria-label", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-activedescendant="active-instructor"></div>
      <div role="listbox">
        <div id="active-instructor" role="option" aria-label="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Labeled active descendants should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Labeled active descendants should render.");
  });

  it("injects ratings when ARIA comboboxes control selected instructor options", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option">Ada Lovelace</div>
        <div role="option" aria-selected="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA controlled option should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA controlled option should render.");
  });

  it("injects ratings when controlled list items use selected ARIA state without option roles", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <ul id="instructor-options" role="listbox">
        <li>Ada Lovelace</li>
        <li aria-selected="true">YAP, CHEE KENG</li>
      </ul>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected ARIA list items should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected ARIA list items should render.");
  });

  it("injects ratings when ARIA comboboxes own selected instructor options", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-owns="owned-instructor-options"></div>
      <div id="owned-instructor-options" role="listbox">
        <div role="option">Ada Lovelace</div>
        <div role="option" aria-selected="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA owned option should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA owned option should render.");
  });

  it("injects ratings when ARIA comboboxes control multiple option lists", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="course-options instructor-options"></div>
      <div id="course-options" role="listbox">
        <div role="option" aria-selected="true">CSCI-UA 201</div>
      </div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-selected="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Multiple ARIA controlled lists should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Multiple ARIA controlled lists should render.");
  });

  it("injects ratings when ARIA selected options use mixed-case boolean values", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-selected="True">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Mixed-case selected options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Mixed-case selected options should render.");
  });

  it("injects ratings when controlled instructor options use selected attribute state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" selected>YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected attribute options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected attribute options should render.");
  });

  it("injects ratings when selected ARIA options expose instructor names in aria-label", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-selected="true" aria-label="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA-labeled options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA-labeled options should render.");
  });

  it("injects ratings when selected custom options expose instructor names in data-value", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-selected="true" data-value="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-value options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-value options should render.");
  });

  it("injects ratings when selected custom options expose instructor names in data-label", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-selected="true" data-label="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-label options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-label options should render.");
  });

  it("injects ratings when selected custom options expose instructor names in data-text", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-selected="true" data-text="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-text options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-text options should render.");
  });

  it("injects ratings when selected custom options expose instructor names in data-display", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-selected="true" data-display="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-display options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-display options should render.");
  });

  it("injects ratings when selected custom options expose instructor names in data-display-name", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-selected="true" data-display-name="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-display-name options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-display-name options should render.");
  });

  it("injects ratings when selected custom options expose instructor names in data-name", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-selected="true" data-name="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-name options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-name options should render.");
  });

  it("injects ratings when custom listbox options use data-selected state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-selected="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-selected options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-selected options should render.");
  });

  it("injects ratings when custom listbox options use data-active state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-active="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-active options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-active options should render.");
  });

  it("injects ratings when active custom options expose names in data-active-label", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-active="true" data-active-label="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 3.6,
      difficulty: 3.1,
      ratingsCount: 66,
      tags: [],
      topComments: ["Active option label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Active option label metadata should render.");
  });

  it("injects ratings when active custom options expose names in data-active-name", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-active="true" data-active-name="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 3.4,
      difficulty: 3.2,
      ratingsCount: 58,
      tags: [],
      topComments: ["Active option name metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Active option name metadata should render.");
  });

  it("injects ratings when active custom options expose names in data-active-text", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-active="true" data-active-text="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 3.5,
      difficulty: 3.7,
      ratingsCount: 72,
      tags: [],
      topComments: ["Active option text metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Active option text metadata should render.");
  });

  it("injects ratings when active custom options expose names in data-active-value", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-active="true" data-active-value="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 3.8,
      difficulty: 2.9,
      ratingsCount: 84,
      tags: [],
      topComments: ["Active option value metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Active option value metadata should render.");
  });

  it("injects ratings when custom listbox options use data-highlighted state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-highlighted>YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-highlighted options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-highlighted options should render.");
  });

  it("injects ratings when highlighted custom options expose names in data-highlighted-label", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-highlighted data-highlighted-label="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 3.9,
      difficulty: 3.0,
      ratingsCount: 77,
      tags: [],
      topComments: ["Highlighted option label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Highlighted option label metadata should render.");
  });

  it("injects ratings when highlighted custom options expose names in data-highlighted-name", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-highlighted data-highlighted-name="YAP, CHEE KENG"></div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.0,
      difficulty: 2.7,
      ratingsCount: 88,
      tags: [],
      topComments: ["Highlighted option name metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Highlighted option name metadata should render.");
  });

  it("injects ratings when custom listbox options use data-focus state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-focus="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-focus options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-focus options should render.");
  });

  it("injects ratings when custom listbox options use data-focused state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-focused>YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-focused options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-focused options should render.");
  });

  it("injects ratings when custom listbox options use data-current state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-current="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-current options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-current options should render.");
  });

  it("injects ratings when custom listbox options use checked data-state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-state="checked">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Checked data-state options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Checked data-state options should render.");
  });

  it("injects ratings when custom listbox option buttons use on data-state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <button type="button" data-state="on">YAP, CHEE KENG</button>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["On data-state options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("On data-state options should render.");
  });

  it("injects ratings when custom listbox options use current data-state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-state="current">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Current data-state options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Current data-state options should render.");
  });

  it("injects ratings when custom listbox options use highlighted data-state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-state="highlighted">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Highlighted data-state options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Highlighted data-state options should render.");
  });

  it("injects ratings when custom listbox options use highlight data-state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-state="highlight">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Highlight data-state options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Highlight data-state options should render.");
  });

  it("injects ratings when custom listbox options use selected class state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="ps-dropdown-option is-selected">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected class options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected class options should render.");
  });

  it("injects ratings when custom listbox options use UI state active class", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="ps-dropdown-option ui-state-active">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["UI state active options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("UI state active options should render.");
  });

  it("injects ratings when custom listbox options use UI state highlight class", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="ps-dropdown-option ui-state-highlight">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["UI state highlight options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("UI state highlight options should render.");
  });

  it("injects ratings when custom listbox options use Oracle selected class", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="oj-listview-item oj-selected">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Oracle selected options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Oracle selected options should render.");
  });

  it("injects ratings when custom listbox options use Prime highlight class", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="p-dropdown-item p-highlight">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Prime highlight options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Prime highlight options should render.");
  });

  it("injects ratings when custom listbox options use Prime selected class", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="p-dropdown-item p-selected">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Prime selected options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Prime selected options should render.");
  });

  it("injects ratings when custom listbox options use checked class state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="ps-dropdown-option is-checked">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Checked class options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Checked class options should render.");
  });

  it("injects ratings when custom listbox option buttons use on class state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <button type="button" class="ps-dropdown-option is-on">YAP, CHEE KENG</button>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["On class options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("On class options should render.");
  });

  it("injects ratings when custom listbox option buttons use pressed class state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <button type="button" class="ps-dropdown-option is-pressed">YAP, CHEE KENG</button>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Pressed class options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Pressed class options should render.");
  });

  it("injects ratings when custom listbox options use highlighted class state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="ps-dropdown-option is-highlighted">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Highlighted class options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Highlighted class options should render.");
  });

  it("injects ratings when custom listbox options use focused class state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="ps-dropdown-option is-focused">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Focused class options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Focused class options should render.");
  });

  it("injects ratings when custom listbox options use focus class state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="ps-dropdown-option is-focus">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Focus class options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Focus class options should render.");
  });

  it("injects ratings when custom listbox options use selected option class state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="ps-dropdown-option selected-option">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Selected option class options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Selected option class options should render.");
  });

  it("injects ratings when custom listbox options use prefixed selected option class state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" class="ps-dropdown-option is-selected-option">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Prefixed selected option class options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Prefixed selected option class options should render.");
  });

  it("injects ratings when custom listbox options use aria-checked state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-checked="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Aria-checked options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Aria-checked options should render.");
  });

  it("injects ratings when custom listbox options use data-checked state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" data-checked="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-checked options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-checked options should render.");
  });

  it("injects ratings when custom listbox option buttons use aria-pressed state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <button type="button" aria-pressed="true">YAP, CHEE KENG</button>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Aria-pressed options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Aria-pressed options should render.");
  });

  it("injects ratings when custom listbox option buttons use data-pressed state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <button type="button" data-pressed="true">YAP, CHEE KENG</button>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-pressed options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-pressed options should render.");
  });

  it("injects ratings when custom listbox options use aria-current state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-current="true">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Aria-current options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Aria-current options should render.");
  });

  it("injects ratings when custom listbox options use date aria-current state", async () => {
    document.body.innerHTML = `
      <div role="combobox" aria-label="Instructor" aria-controls="instructor-options"></div>
      <div id="instructor-options" role="listbox">
        <div role="option" aria-current="date">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Date aria-current options should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Date aria-current options should render.");
  });

  it("injects ratings when Albert renders instructor text directly in a heading", async () => {
    document.body.innerHTML = `<h3>Instructor: YAP, CHEE KENG</h3>`;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Heading instructor text should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Heading instructor text should render.");
  });

  it("injects ratings when Albert uses heading labels followed by values", async () => {
    document.body.innerHTML = `
      <h4>Instructor</h4>
      <span>YAP, CHEE KENG</span>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Heading instructor labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Heading instructor labels should render.");
  });

  it("injects ratings when Albert labels instructor table cells through headers attributes", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th id="course-header">Course</th>
            <th id="instructor-header">Instructor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td headers="course-header">CSCI-UA 201 Computer Systems Organization</td>
            <td headers="instructor-header">YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Header-referenced instructor cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Header-referenced instructor cells should render.");
  });

  it("injects ratings when Albert labels instructor table cells through column headers", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Instructor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>CSCI-UA 201 Computer Systems Organization</td>
            <td>YAP, CHEE KENG</td>
            <td>Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Column-header instructor cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Column-header instructor cells should render.");
  });

  it("injects ratings for live Albert enrolled rows that show instructor last names only", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course (Units/Grading Basis)</th>
            <th>Instructor</th>
            <th>Days/Times</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Operating Systems<br />CSCI-UA 202 001 (4)</td>
            <td>Walfish</td>
            <td>MoWe 9:30AM - 10:45AM</td>
          </tr>
          <tr>
            <td>Linear Algebra<br />MATH-UA 140 015</td>
            <td>TBA</td>
            <td>Tu 8:00AM - 9:15AM</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.2,
      ratingsCount: 27,
      tags: [],
      topComments: ["Live Albert last-name instructor cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Walfish", { courseCode: "CSCI-UA 202" });
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Live Albert last-name instructor cells should render.");
    expect(document.body.textContent).toContain("Albert CSCI-UA 202");
  });

  it("injects ratings for the observed Fall 2026 Albert enrolled table without touching TBA rows", async () => {
    document.body.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Course (Units/Grading Basis)</th>
            <th>Instructor</th>
            <th>Instruction Mode and Location</th>
            <th>Time</th>
            <th>Day</th>
            <th>Dates</th>
            <th>Deadlines</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Operating Systems<br />CSCI-UA 202 001 (4)</td>
            <td>Walfish</td>
            <td>In-Person: 251 Mercer St (Warren Weaver) Room 109 Loc:Washington Square</td>
            <td>11:00 AM - 12:15 PM</td>
            <td>MW</td>
            <td>9/2/2026 - 12/14/2026</td>
            <td></td>
          </tr>
          <tr>
            <td>Calculus III<br />MATH-UA 123 011 (4)</td>
            <td>Pang</td>
            <td>In-Person: 19 University Pl Room 102 Loc:Washington Square</td>
            <td>9:30 AM - 10:45 AM</td>
            <td>TR</td>
            <td>9/2/2026 - 12/14/2026</td>
            <td></td>
          </tr>
          <tr>
            <td>Calculus III<br />MATH-UA 123 013 (4)</td>
            <td>TBA</td>
            <td>In-Person: Washington Square</td>
            <td>11:00 AM - 12:15 PM</td>
            <td>TR</td>
            <td>9/2/2026 - 12/14/2026</td>
            <td></td>
          </tr>
          <tr>
            <td>Linear Algebra<br />MATH-UA 140 011 (4)</td>
            <td>Majmudar</td>
            <td>In-Person: Washington Square</td>
            <td>12:30 PM - 1:45 PM</td>
            <td>TR</td>
            <td>9/2/2026 - 12/14/2026</td>
            <td></td>
          </tr>
          <tr>
            <td>Linear Algebra<br />MATH-UA 140 015 (4)</td>
            <td>TBA</td>
            <td>In-Person: Washington Square</td>
            <td>2:00 PM - 3:15 PM</td>
            <td>TR</td>
            <td>9/2/2026 - 12/14/2026</td>
            <td></td>
          </tr>
          <tr>
            <td>Natural Language Processing<br />CSCI-UA 469 002 (4)</td>
            <td>Meyers</td>
            <td>In-Person: Washington Square</td>
            <td>3:30 PM - 4:45 PM</td>
            <td>MW</td>
            <td>9/2/2026 - 12/14/2026</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => {
      if (name === "Meyers") {
        return null;
      }
      return {
        name,
        rating: 4.1,
        difficulty: 3.2,
        ratingsCount: 27,
        tags: [],
        topComments: [`${name} live Albert row rendered.`],
        url: "https://www.ratemyprofessors.com/professor/419998",
      };
    });

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(4);
    expect(lookupProfessor).toHaveBeenCalledWith("Walfish", { courseCode: "CSCI-UA 202" });
    expect(lookupProfessor).toHaveBeenCalledWith("Pang", { courseCode: "MATH-UA 123" });
    expect(lookupProfessor).toHaveBeenCalledWith("Majmudar", { courseCode: "MATH-UA 140" });
    expect(lookupProfessor).toHaveBeenCalledWith("Meyers", { courseCode: "CSCI-UA 469" });
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(4);
    expect(document.querySelectorAll(".nyu-rmp-radar")).toHaveLength(3);
    expect(document.querySelectorAll(".nyu-rmp-card.is-empty")).toHaveLength(1);
    expect(document.body.textContent).not.toContain("TBA live Albert row rendered.");
    expect(Array.from(document.querySelectorAll(".nyu-rmp-course-context")).map((node) => node.textContent.replace(/\s+/g, " ").trim())).toEqual([
      "Albert CSCI-UA 202",
      "Albert MATH-UA 123",
      "Albert MATH-UA 140",
      "Albert CSCI-UA 469",
    ]);
  });

  it("injects ratings when Albert labels responsive table cells with data-label", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-label="Course">CSCI-UA 201 Computer Systems Organization</td>
            <td data-label="Instructor">YAP, CHEE KENG</td>
            <td data-label="Status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Responsive cell labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Responsive cell labels should render.");
  });

  it("injects ratings when Albert labels compact table cells with aria-label", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td aria-label="Course">CSCI-UA 201 Computer Systems Organization</td>
            <td aria-label="Instructor">YAP, CHEE KENG</td>
            <td aria-label="Status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA-labeled table cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA-labeled table cells should render.");
  });

  it("injects ratings when Albert renders instructor text directly in semantic sections", async () => {
    document.body.innerHTML = `
      <section>Instructor: YAP, CHEE KENG</section>
      <article>Professor: Ada Lovelace</article>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.2,
      ratingsCount: 27,
      tags: [],
      topComments: [`Semantic container for ${name} should render.`],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(2);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(document.body.textContent).toContain("Semantic container for Chee Keng Yap should render.");
    expect(document.body.textContent).toContain("Semantic container for Ada Lovelace should render.");
  });

  it("injects ratings when Albert renders instructor values in ARIA grid cells", async () => {
    document.body.innerHTML = `
      <div role="grid">
        <div role="row">
          <div role="gridcell" aria-label="Course">CSCI-UA 201 Computer Systems Organization</div>
          <div role="gridcell" aria-label="Instructor">YAP, CHEE KENG</div>
          <div role="gridcell" aria-label="Status">Open</div>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA grid cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA grid cells should render.");
  });

  it("injects ratings when Albert labels ARIA grid instructor cells with column headers", async () => {
    document.body.innerHTML = `
      <div role="grid">
        <div role="row">
          <div role="columnheader">Course</div>
          <div role="columnheader">Instructor</div>
          <div role="columnheader">Status</div>
        </div>
        <div role="row">
          <div role="gridcell">CSCI-UA 201 Computer Systems Organization</div>
          <div role="gridcell">YAP, CHEE KENG</div>
          <div role="gridcell">Open</div>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA column headers should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA column headers should render.");
  });

  it("injects ratings when Albert labels instructor cells with aria-labelledby", async () => {
    document.body.innerHTML = `
      <span id="course-cell-label">Course</span>
      <span id="instructor-cell-label">Instructor</span>
      <div role="grid">
        <div role="row">
          <div role="gridcell" aria-labelledby="course-cell-label">CSCI-UA 201 Computer Systems Organization</div>
          <div role="gridcell" aria-labelledby="instructor-cell-label">YAP, CHEE KENG</div>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA-labelled-by instructor cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA-labelled-by instructor cells should render.");
  });

  it("injects ratings when Albert describes instructor cells with aria-describedby", async () => {
    document.body.innerHTML = `
      <span id="course-cell-description">Course</span>
      <span id="instructor-cell-description">Instructor</span>
      <div role="grid">
        <div role="row">
          <div role="gridcell" aria-describedby="course-cell-description">CSCI-UA 201 Computer Systems Organization</div>
          <div role="gridcell" aria-describedby="instructor-cell-description">YAP, CHEE KENG</div>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA-described-by instructor cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA-described-by instructor cells should render.");
  });

  it("injects ratings when Albert maps ARIA grid instructor cells by aria-colindex", async () => {
    document.body.innerHTML = `
      <div role="grid">
        <div role="row">
          <div role="columnheader" aria-colindex="1">Course</div>
          <div role="columnheader" aria-colindex="2">Instructor</div>
          <div role="columnheader" aria-colindex="3">Status</div>
        </div>
        <div role="row">
          <div role="gridcell" aria-colindex="2">YAP, CHEE KENG</div>
          <div role="gridcell" aria-colindex="3">Open</div>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["ARIA colindex instructor cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("ARIA colindex instructor cells should render.");
  });

  it("injects ratings when Albert labels instructor cells with PeopleSoft field-name attributes", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-fieldname="COURSE_TITLE">CSCI-UA 201 Computer Systems Organization</td>
            <td data-fieldname="INSTRUCTOR">YAP, CHEE KENG</td>
            <td data-fieldname="ENROLL_STATUS">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Field-name instructor cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Field-name instructor cells should render.");
  });

  it("injects ratings when PeopleSoft field labels use underscores around instructor words", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-fieldname="COURSE_TITLE">CSCI-UA 201 Computer Systems Organization</td>
            <td data-fieldname="PRIMARY_INSTRUCTOR">YAP, CHEE KENG</td>
            <td data-fieldname="SECTION_STATUS">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Underscored field labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Underscored field labels should render.");
  });

  it("injects ratings when PeopleSoft field labels abbreviate instructor names", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-fieldname="CRSE_TITLE">CSCI-UA 201 Computer Systems Organization</td>
            <td data-fieldname="INSTR_NAME">YAP, CHEE KENG</td>
            <td data-fieldname="ENRL_STAT">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Abbreviated field labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Abbreviated field labels should render.");
  });

  it("injects ratings when PeopleSoft field labels embed instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-fieldname="SSR_CRSE_TITLE_LONG">CSCI-UA 201 Computer Systems Organization</td>
            <td data-fieldname="SSR_INSTR_LONG">YAP, CHEE KENG</td>
            <td data-fieldname="SSR_ENRL_STAT">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Embedded field labels should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Embedded field labels should render.");
  });

  it("injects ratings when explicit field-label metadata labels instructor cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-field-label="Course">CSCI-UA 201 Computer Systems Organization</td>
            <td data-field-label="Instructor">YAP, CHEE KENG</td>
            <td data-field-label="Status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Field-label metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Field-label metadata should render.");
  });

  it("injects ratings when abbreviated field metadata embeds instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-fldname="SSR_CRSE_TITLE_LONG">CSCI-UA 201 Computer Systems Organization</td>
            <td data-fldname="SSR_INSTR_LONG">YAP, CHEE KENG</td>
            <td data-fldname="SSR_ENRL_STAT">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Abbreviated field metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Abbreviated field metadata should render.");
  });

  it("injects ratings when abbreviated column metadata labels instructor cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-col-label="Course">CSCI-UA 201 Computer Systems Organization</td>
            <td data-col-label="Instructor">YAP, CHEE KENG</td>
            <td data-col-label="Status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Abbreviated column metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Abbreviated column metadata should render.");
  });

  it("injects ratings when generated column-name attributes embed instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-columnname="SSR_CRSE_TITLE_LONG">CSCI-UA 201 Computer Systems Organization</td>
            <td data-columnname="SSR_INSTR_LONG">YAP, CHEE KENG</td>
            <td data-columnname="SSR_ENRL_STAT">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Column-name instructor cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Column-name instructor cells should render.");
  });

  it("injects ratings when generated column-id attributes embed instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-columnid="SSR_CRSE_TITLE_LONG$0">CSCI-UA 201 Computer Systems Organization</td>
            <td data-columnid="SSR_INSTR_LONG$0">YAP, CHEE KENG</td>
            <td data-columnid="SSR_ENRL_STAT$0">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Column-id instructor cells should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Column-id instructor cells should render.");
  });

  it("injects ratings when generated cell ids embed instructor field tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td id="SSR_CRSE_TITLE_LONG$0">CSCI-UA 201 Computer Systems Organization</td>
            <td id="SSR_INSTR_LONG$0">YAP, CHEE KENG</td>
            <td id="SSR_ENRL_STAT$0">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Generated field ids should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Generated field ids should render.");
  });

  it("injects ratings when generated field-id attributes embed instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-fieldid="SSR_CRSE_TITLE_LONG$0">CSCI-UA 201 Computer Systems Organization</td>
            <td data-fieldid="SSR_INSTR_LONG$0">YAP, CHEE KENG</td>
            <td data-fieldid="SSR_ENRL_STAT$0">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Generated field ids in attributes should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Generated field ids in attributes should render.");
  });

  it("injects ratings when prefixed PeopleSoft field metadata embeds instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-ps-fieldname="SSR_CRSE_TITLE_LONG">CSCI-UA 201 Computer Systems Organization</td>
            <td data-ps-fieldname="SSR_INSTR_LONG">YAP, CHEE KENG</td>
            <td data-ps-fieldname="SSR_ENRL_STAT">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Prefixed PeopleSoft metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Prefixed PeopleSoft metadata should render.");
  });

  it("injects ratings when prefixed PeopleSoft field-id metadata embeds instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-ps-fieldid="SSR_CRSE_TITLE_LONG$0">CSCI-UA 201 Computer Systems Organization</td>
            <td data-ps-fieldid="SSR_INSTR_LONG$0">YAP, CHEE KENG</td>
            <td data-ps-fieldid="SSR_ENRL_STAT$0">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Prefixed PeopleSoft field ids should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Prefixed PeopleSoft field ids should render.");
  });

  it("injects ratings when hyphenated PeopleSoft field-id metadata embeds instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-ps-field-id="SSR_CRSE_TITLE_LONG$0">CSCI-UA 201 Computer Systems Organization</td>
            <td data-ps-field-id="SSR_INSTR_LONG$0">YAP, CHEE KENG</td>
            <td data-ps-field-id="SSR_ENRL_STAT$0">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Hyphenated PeopleSoft field ids should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Hyphenated PeopleSoft field ids should render.");
  });

  it("injects ratings when prefixed PeopleSoft column metadata embeds instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-ps-columnname="SSR_CRSE_TITLE_LONG">CSCI-UA 201 Computer Systems Organization</td>
            <td data-ps-columnname="SSR_INSTR_LONG">YAP, CHEE KENG</td>
            <td data-ps-columnname="SSR_ENRL_STAT">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Prefixed PeopleSoft column metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Prefixed PeopleSoft column metadata should render.");
  });

  it("injects ratings when prefixed PeopleSoft column-id metadata embeds instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-ps-columnid="SSR_CRSE_TITLE_LONG$0">CSCI-UA 201 Computer Systems Organization</td>
            <td data-ps-columnid="SSR_INSTR_LONG$0">YAP, CHEE KENG</td>
            <td data-ps-columnid="SSR_ENRL_STAT$0">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Prefixed PeopleSoft column ids should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Prefixed PeopleSoft column ids should render.");
  });

  it("injects ratings when hyphenated PeopleSoft column-id metadata embeds instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-ps-column-id="SSR_CRSE_TITLE_LONG$0">CSCI-UA 201 Computer Systems Organization</td>
            <td data-ps-column-id="SSR_INSTR_LONG$0">YAP, CHEE KENG</td>
            <td data-ps-column-id="SSR_ENRL_STAT$0">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Hyphenated PeopleSoft column ids should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Hyphenated PeopleSoft column ids should render.");
  });

  it("injects ratings when generated cell class names embed instructor tokens", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td class="ps_box-value SSR_CRSE_TITLE_LONG">CSCI-UA 201 Computer Systems Organization</td>
            <td class="ps_box-value SSR_INSTR_LONG">YAP, CHEE KENG</td>
            <td class="ps_box-value SSR_ENRL_STAT">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Generated class names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Generated class names should render.");
  });

  it("injects ratings when test-id metadata labels instructor cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-testid="course-title">CSCI-UA 201 Computer Systems Organization</td>
            <td data-testid="instructor-name">YAP, CHEE KENG</td>
            <td data-testid="section-status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Test-id metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Test-id metadata should render.");
  });

  it("injects ratings when QA metadata labels instructor cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-qa="course-title">CSCI-UA 201 Computer Systems Organization</td>
            <td data-qa="instructor-name">YAP, CHEE KENG</td>
            <td data-qa="section-status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["QA metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("QA metadata should render.");
  });

  it("injects ratings when automation-id metadata labels instructor cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-automation-id="course-title">CSCI-UA 201 Computer Systems Organization</td>
            <td data-automation-id="instructor-name">YAP, CHEE KENG</td>
            <td data-automation-id="section-status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Automation metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Automation metadata should render.");
  });

  it("injects ratings when slot metadata labels instructor cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-slot="course-title">CSCI-UA 201 Computer Systems Organization</td>
            <td data-slot="instructor-name">YAP, CHEE KENG</td>
            <td data-slot="section-status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Slot metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Slot metadata should render.");
  });

  it("injects ratings when data-name metadata labels instructor cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-name="course-title">CSCI-UA 201 Computer Systems Organization</td>
            <td data-name="instructor-name">YAP, CHEE KENG</td>
            <td data-name="section-status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Data-name metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Data-name metadata should render.");
  });

  it("injects ratings when PeopleSoft panel-field metadata labels instructor cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-pnlfldid="DERIVED_CLS_DTL_DESCR$0">CSCI-UA 201 Computer Systems Organization</td>
            <td data-pnlfldid="DERIVED_CLS_DTL_SSR_INSTR_LONG$0">YAP, CHEE KENG</td>
            <td data-pnlfldid="DERIVED_CLS_DTL_ENRL_STAT$0">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Panel-field metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Panel-field metadata should render.");
  });

  it("injects ratings when tooltip-style metadata labels instructor cells", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td data-tooltip="Course">CSCI-UA 201 Computer Systems Organization</td>
            <td data-tooltip="Instructor">YAP, CHEE KENG</td>
            <td data-tooltip="Status">Open</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Tooltip metadata should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Tooltip metadata should render.");
  });

  it("skips adjacent metadata cells before an unmarked instructor name cell", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>Permission Required</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("skips adjacent Albert helper text before an unmarked instructor name cell", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td>View instructor details</td>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
  });

  it("uses adjacent Albert title attributes when visible cell text is helper text", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor</th>
            <td title="YAP, CHEE KENG">View instructor details</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 2.1,
      difficulty: 4.5,
      ratingsCount: 92,
      tags: [],
      topComments: ["Title-backed instructor names should render."],
      url: "https://www.ratemyprofessors.com/professor/419998",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Title-backed instructor names should render.");
  });

  it("keeps injected ratings inside table cells instead of adding invalid row children", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr id="section-row">
            <th>Instructor</th>
            <td>YAP, CHEE KENG</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const row = document.querySelector("#section-row");
    expect(Array.from(row.children).map((child) => child.tagName)).toEqual(["TH", "TD"]);
    expect(row.querySelector("td .nyu-rmp-rating-root")).not.toBeNull();
    expect(row.querySelector("td").style.display).toBe("");
    expect(row.querySelector("td").style.flexWrap).toBe("wrap");
    expect(row.querySelector("td").style.getPropertyPriority("display")).toBe("");
    expect(row.querySelector("td").style.getPropertyPriority("flex-wrap")).toBe("important");
  });

  it("keeps Albert gridcell instructor text readable when marking it processed", async () => {
    document.body.innerHTML = `
      <div role="row" id="grid-row">
        <div role="gridcell">CSCI-UA 201 Computer Systems Organization</div>
        <div role="gridcell" id="grid-instructor" aria-label="Instructor">YAP, CHEE KENG</div>
        <div role="gridcell">Open</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const instructorCell = document.getElementById("grid-instructor");
    const originalContent = instructorCell.querySelector(":scope > .nyu-rmp-albert-original");
    const ratingRoot = instructorCell.querySelector(":scope > .nyu-rmp-rating-root");
    expect(instructorCell.dataset.nyuRmpProcessed).toBe("true");
    expect(originalContent).not.toBeNull();
    expect(originalContent.dataset.nyuRmpOriginal).toBe("true");
    expect(originalContent.dataset.nyuRmpVersion).toBe("0.1.2");
    expect(originalContent.textContent.trim()).toBe("YAP, CHEE KENG");
    expect(instructorCell.style.display).toBe("block");
    expect(instructorCell.style.alignItems).toBe("flex-start");
    expect(instructorCell.style.flexWrap).toBe("wrap");
    expect(instructorCell.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
    expect(instructorCell.style.minInlineSize).toBe("0px");
    expect(instructorCell.style.minWidth).toBe("0px");
    expect(instructorCell.style.overflowWrap).toBe("normal");
    expect(instructorCell.style.whiteSpace).toBe("normal");
    expect(instructorCell.style.wordBreak).toBe("normal");
    expect(instructorCell.style.getPropertyPriority("display")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("align-items")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("flex-wrap")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("grid-template-columns")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("min-inline-size")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("min-width")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("overflow-wrap")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("white-space")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("word-break")).toBe("important");
    for (const mountedChild of [originalContent, ratingRoot]) {
      expect(mountedChild.style.flex).toBe("0 0 100%");
      expect(mountedChild.style.gridColumn).toBe("1 / -1");
      expect(mountedChild.style.minInlineSize).toBe("0px");
      expect(mountedChild.style.minWidth).toBe("0px");
      expect(mountedChild.style.overflowWrap).toBe("normal");
      expect(mountedChild.style.whiteSpace).toBe("normal");
      expect(mountedChild.style.width).toBe("100%");
      expect(mountedChild.style.wordBreak).toBe("normal");
      expect(mountedChild.style.getPropertyPriority("flex")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("grid-column")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("min-inline-size")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("min-width")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("overflow-wrap")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("white-space")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("width")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("word-break")).toBe("important");
    }
    expect(Array.from(instructorCell.children).map((child) => child.className)).toEqual([
      "nyu-rmp-albert-original",
      "nyu-rmp-rating-root is-cell-mounted",
    ]);
    expect(ratingRoot).not.toBeNull();
    expect(ratingRoot.classList.contains("is-cell-mounted")).toBe(true);
    expect(ratingRoot.querySelector(".nyu-rmp-card")).not.toBeNull();
  });

  it("applies inline safeguards to adjacent label cells that are marked processed", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="instructor-label">Instructor</div>
        <div role="gridcell" id="grid-instructor">Ada Lovelace</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const labelCell = document.getElementById("instructor-label");
    const instructorCell = document.getElementById("grid-instructor");
    expect(labelCell.dataset.nyuRmpProcessed).toBe("true");
    expect(instructorCell.dataset.nyuRmpProcessed).toBe("true");
    expect(labelCell.style.display).toBe("block");
    expect(labelCell.style.getPropertyPriority("display")).toBe("important");
    expect(labelCell.style.flexWrap).toBe("wrap");
    expect(labelCell.style.getPropertyPriority("flex-wrap")).toBe("important");
    expect(instructorCell.querySelector(".nyu-rmp-rating-root")).not.toBeNull();
  });

  it("does not rescan wrapped original content inside processed Albert gridcells", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor">Instructor: Ada Lovelace</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const instructorCell = document.getElementById("grid-instructor");
    expect(instructorCell.querySelector(".nyu-rmp-albert-original").textContent.trim()).toBe("Instructor: Ada Lovelace");
    expect(instructorCell.querySelectorAll(".nyu-rmp-rating-root")).toHaveLength(1);
    expect(instructorCell.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(lookupProfessor).toHaveBeenCalledTimes(1);
  });

  it("repairs inline child safeguards on already processed Albert gridcells", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" data-nyu-rmp-processed="true">
          <div class="nyu-rmp-albert-original" data-nyu-rmp-original="true">Ada Lovelace</div>
          <div class="nyu-rmp-rating-root is-cell-mounted" data-nyu-rmp-version="0.1.2"></div>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const originalContent = document.querySelector("#grid-instructor > .nyu-rmp-albert-original");
    const ratingRoot = document.querySelector("#grid-instructor > .nyu-rmp-rating-root");
    const instructorCell = document.getElementById("grid-instructor");
    expect(instructorCell.style.alignItems).toBe("flex-start");
    expect(instructorCell.style.flexWrap).toBe("wrap");
    expect(instructorCell.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
    expect(instructorCell.style.minInlineSize).toBe("0px");
    expect(instructorCell.style.minWidth).toBe("0px");
    expect(instructorCell.style.overflowWrap).toBe("normal");
    expect(instructorCell.style.whiteSpace).toBe("normal");
    expect(instructorCell.style.wordBreak).toBe("normal");
    expect(instructorCell.style.getPropertyPriority("align-items")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("flex-wrap")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("grid-template-columns")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("min-inline-size")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("min-width")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("overflow-wrap")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("white-space")).toBe("important");
    expect(instructorCell.style.getPropertyPriority("word-break")).toBe("important");
    for (const mountedChild of [originalContent, ratingRoot]) {
      expect(mountedChild.style.flex).toBe("0 0 100%");
      expect(mountedChild.style.gridColumn).toBe("1 / -1");
      expect(mountedChild.style.minInlineSize).toBe("0px");
      expect(mountedChild.style.minWidth).toBe("0px");
      expect(mountedChild.style.overflowWrap).toBe("normal");
      expect(mountedChild.style.whiteSpace).toBe("normal");
      expect(mountedChild.style.width).toBe("100%");
      expect(mountedChild.style.wordBreak).toBe("normal");
      expect(mountedChild.style.getPropertyPriority("flex")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("grid-column")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("min-inline-size")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("min-width")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("overflow-wrap")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("white-space")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("width")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("word-break")).toBe("important");
    }
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
  });

  it("replaces stale processed Albert rating roots with the score-first quick view", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" data-nyu-rmp-processed="true">
          <div class="nyu-rmp-albert-original" data-nyu-rmp-original="true">Ada Lovelace</div>
          <div class="nyu-rmp-rating-root is-cell-mounted" data-nyu-rmp-version="0.1.2">
            <article class="nyu-rmp-card rating-good" data-nyu-rmp-requested-name="Ada Lovelace" data-nyu-rmp-version="0.1.2">
              <div class="nyu-rmp-card-head"><strong>Ada Lovelace</strong></div>
              <div class="nyu-rmp-department">Computer Science</div>
              <dl class="nyu-rmp-score-row nyu-rmp-metrics"></dl>
              <div class="nyu-rmp-radar-wrap"></div>
              <div class="nyu-rmp-comments-panel">Old comment text</div>
            </article>
          </div>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      department: "Computer Science",
      rating: 4.7,
      difficulty: 2.4,
      ratingsCount: 38,
      wouldTakeAgain: 92,
      tags: ["Helpful"],
      topComments: ["Explains low-level systems clearly."],
      url: "https://www.ratemyprofessors.com/professor/123",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const ratingRoot = document.querySelector("#grid-instructor > .nyu-rmp-rating-root");
    const card = ratingRoot.querySelector(".nyu-rmp-card");
    const quickGrid = card.querySelector(":scope > .nyu-rmp-quick-grid");
    expect(ratingRoot.dataset.nyuRmpVersion).toBe("0.1.2");
    expect(ratingRoot.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(quickGrid).not.toBeNull();
    expect(quickGrid.textContent.replace(/\s+/g, " ").trim()).toBe("RMP 4.7 Strong rating 38 ratings Recent comments Radar map");
    expect(card.querySelector(":scope > .nyu-rmp-card-head")).toBeNull();
    expect(card.querySelector(":scope > .nyu-rmp-department")).toBeNull();
    expect(card.querySelector(".nyu-rmp-score-row").closest(".nyu-rmp-radar-panel").hidden).toBe(true);
    expect(card.querySelector(".nyu-rmp-comments-panel").hidden).toBe(true);
    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
  });

  it("uses stale rating card names to refresh processed Albert roots without original wrappers", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" data-nyu-rmp-processed="true">
          <div class="nyu-rmp-rating-root is-cell-mounted">
            <article class="nyu-rmp-card rating-good" data-nyu-rmp-requested-name="Grace Hopper">
              <div class="nyu-rmp-card-head"><strong>Grace Hopper</strong></div>
            </article>
          </div>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.2,
      difficulty: 2.8,
      ratingsCount: 17,
      wouldTakeAgain: 82,
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const card = document.querySelector("#grid-instructor .nyu-rmp-card");
    expect(document.querySelectorAll("#grid-instructor .nyu-rmp-card")).toHaveLength(1);
    expect(card.dataset.nyuRmpRequestedName).toBe("Grace Hopper");
    expect(card.querySelector(":scope > .nyu-rmp-quick-grid")).not.toBeNull();
    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Grace Hopper");
  });

  it("repairs processed Albert layout safeguards on demand", () => {
    document.body.innerHTML = `
      <div role="gridcell" id="grid-instructor" data-nyu-rmp-processed="true">
        <div class="nyu-rmp-albert-original" data-nyu-rmp-original="true">Ada Lovelace</div>
        <div class="nyu-rmp-rating-root is-cell-mounted" data-nyu-rmp-version="0.1.2"></div>
      </div>
    `;

    const result = repairAlbertRmpLayoutSafeguards(document);

    const instructorCell = document.getElementById("grid-instructor");
    const originalContent = instructorCell.querySelector(":scope > .nyu-rmp-albert-original");
    const ratingRoot = instructorCell.querySelector(":scope > .nyu-rmp-rating-root");
    expect(result).toEqual({ repairedCount: 1 });
    expect(instructorCell.style.alignItems).toBe("flex-start");
    expect(instructorCell.style.getPropertyPriority("align-items")).toBe("important");
    expect(instructorCell.style.whiteSpace).toBe("normal");
    expect(instructorCell.style.getPropertyPriority("white-space")).toBe("important");
    for (const mountedChild of [originalContent, ratingRoot]) {
      expect(mountedChild.style.flex).toBe("0 0 100%");
      expect(mountedChild.style.width).toBe("100%");
      expect(mountedChild.style.whiteSpace).toBe("normal");
      expect(mountedChild.style.getPropertyPriority("flex")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("width")).toBe("important");
      expect(mountedChild.style.getPropertyPriority("white-space")).toBe("important");
    }
  });

  it("still scans a newly added instructor gridcell beside an already processed cell", async () => {
    document.body.innerHTML = `
      <div role="row" id="grid-row">
        <div role="gridcell">CSCI-UA 201 Computer Systems Organization</div>
        <div role="gridcell" id="primary-instructor" aria-label="Instructor">Ada Lovelace</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.getElementById("grid-row").insertAdjacentHTML("beforeend", `
      <div role="gridcell" id="secondary-instructor" aria-label="Instructor">Grace Hopper</div>
    `);
    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.getElementById("primary-instructor").querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.getElementById("secondary-instructor").querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(lookupProfessor).toHaveBeenCalledTimes(2);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace Hopper");
  });

  it("scans a newly added co-instructor inside an already processed Albert gridcell", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" aria-label="Instructor">Ada Lovelace</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.querySelector("#grid-instructor .nyu-rmp-albert-original").append(" + Grace Hopper");
    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const instructorCell = document.getElementById("grid-instructor");
    expect(instructorCell.querySelectorAll(":scope > .nyu-rmp-rating-root")).toHaveLength(1);
    expect(instructorCell.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(lookupProfessor).toHaveBeenCalledTimes(2);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace Hopper");
  });

  it("removes stale cards when Albert replaces the instructor inside a processed gridcell", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" aria-label="Instructor">Ada Lovelace</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.querySelector("#grid-instructor .nyu-rmp-albert-original").textContent = "Grace Hopper";
    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const cards = Array.from(document.querySelectorAll("#grid-instructor .nyu-rmp-card"));
    expect(cards).toHaveLength(1);
    expect(cards[0].dataset.nyuRmpRequestedName).toBe("Grace Hopper");
    expect(document.getElementById("grid-instructor").textContent).not.toContain("Ada Lovelace");
    expect(lookupProfessor).toHaveBeenCalledTimes(2);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace Hopper");
  });

  it("ignores pending stale lookup updates after Albert replaces a processed gridcell instructor", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" aria-label="Instructor">Ada Lovelace</div>
      </div>
    `;
    let resolveAda;
    let resolveGrace;
    const lookupProfessor = vi.fn((name) => new Promise((resolve) => {
      if (name === "Ada Lovelace") {
        resolveAda = resolve;
      } else if (name === "Grace Hopper") {
        resolveGrace = resolve;
      }
    }));

    const firstScan = scanAlbertPageOnce({ document, lookupProfessor });
    const staleCard = document.querySelector("#grid-instructor .nyu-rmp-card");
    document.querySelector("#grid-instructor .nyu-rmp-albert-original").textContent = "Grace Hopper";
    const secondScan = scanAlbertPageOnce({ document, lookupProfessor });

    expect(staleCard.isConnected).toBe(false);
    resolveAda({
      name: "Ada Lovelace",
      department: "Ada-only stale department",
      rating: 4.9,
      difficulty: 1.1,
      wouldTakeAgain: 99,
      ratingsCount: 42,
      url: "https://www.ratemyprofessors.com/professor/1",
      tags: [],
      topComments: ["Ada-only resolved comment."],
    });
    resolveGrace({
      name: "Grace Hopper",
      department: "Grace-only current department",
      rating: 4.7,
      difficulty: 1.4,
      wouldTakeAgain: 96,
      ratingsCount: 58,
      url: "https://www.ratemyprofessors.com/professor/2",
      tags: [],
      topComments: ["Grace-only resolved comment."],
    });
    await Promise.allSettled([...firstScan.pendingLookups, ...secondScan.pendingLookups]);

    const cards = Array.from(document.querySelectorAll("#grid-instructor .nyu-rmp-card"));
    expect(cards).toHaveLength(1);
    expect(cards[0].dataset.nyuRmpRequestedName).toBe("Grace Hopper");
    expect(cards[0].textContent).toContain("Grace-only current department");
    expect(cards[0].textContent).not.toContain("Ada-only stale department");
    expect(staleCard.textContent).not.toContain("Ada-only stale department");
    expect(lookupProfessor).toHaveBeenCalledTimes(2);
  });

  it("syncs processed-cell cards when Albert replaces one instructor and adds another", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" aria-label="Instructor">Ada Lovelace + Alan Turing</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    document.querySelector("#grid-instructor .nyu-rmp-albert-original").textContent = "Grace Hopper + Alan Turing";
    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const cardNames = Array.from(document.querySelectorAll("#grid-instructor .nyu-rmp-card"))
      .map((card) => card.dataset.nyuRmpRequestedName);
    expect(cardNames).toEqual(["Alan Turing", "Grace Hopper"]);
    expect(lookupProfessor).toHaveBeenCalledTimes(3);
    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).toHaveBeenCalledWith("Alan Turing");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace Hopper");
  });

  it("removes original-content wrappers when the overlay is disabled", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" aria-label="Instructor">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    removeAlbertRmpEnhancements(document);

    const instructorCell = document.getElementById("grid-instructor");
    expect(instructorCell.querySelector(".nyu-rmp-albert-original")).toBeNull();
    expect(instructorCell.querySelector(".nyu-rmp-rating-root")).toBeNull();
    expect(instructorCell.textContent.trim()).toBe("YAP, CHEE KENG");
    expect(instructorCell.dataset.nyuRmpProcessed).toBeUndefined();
    expect(instructorCell.style.display).toBe("");
    expect(instructorCell.style.alignItems).toBe("");
    expect(instructorCell.style.flexWrap).toBe("");
    expect(instructorCell.style.gridTemplateColumns).toBe("");
    expect(instructorCell.style.minWidth).toBe("");
  });

  it("restores pre-existing Albert inline cell styles when the overlay is disabled", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" aria-label="Instructor">YAP, CHEE KENG</div>
      </div>
    `;
    const instructorCell = document.getElementById("grid-instructor");
    instructorCell.style.setProperty("display", "flex", "important");
    instructorCell.style.setProperty("align-items", "center");
    instructorCell.style.setProperty("flex-wrap", "nowrap");
    instructorCell.style.setProperty("grid-template-columns", "72px minmax(0, 1fr)");
    instructorCell.style.setProperty("min-width", "144px", "important");
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    expect(instructorCell.style.display).toBe("block");
    expect(instructorCell.style.getPropertyPriority("display")).toBe("important");
    expect(instructorCell.style.flexWrap).toBe("wrap");
    expect(instructorCell.style.getPropertyPriority("flex-wrap")).toBe("important");

    removeAlbertRmpEnhancements(document);

    expect(instructorCell.dataset.nyuRmpProcessedCellStyleSnapshot).toBeUndefined();
    expect(instructorCell.style.display).toBe("flex");
    expect(instructorCell.style.getPropertyPriority("display")).toBe("important");
    expect(instructorCell.style.alignItems).toBe("center");
    expect(instructorCell.style.getPropertyPriority("align-items")).toBe("");
    expect(instructorCell.style.flexWrap).toBe("nowrap");
    expect(instructorCell.style.gridTemplateColumns).toBe("72px minmax(0, 1fr)");
    expect(instructorCell.style.minWidth).toBe("144px");
    expect(instructorCell.style.getPropertyPriority("min-width")).toBe("important");
  });

  it("does not remove table display when cleaning up a processed table cell without a style snapshot", () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <td id="instructor-cell" data-nyu-rmp-processed="true" style="display: table-cell; flex-wrap: wrap;">Ada Lovelace</td>
          </tr>
        </tbody>
      </table>
    `;

    removeAlbertRmpEnhancements(document);

    const instructorCell = document.getElementById("instructor-cell");
    expect(instructorCell.dataset.nyuRmpProcessed).toBeUndefined();
    expect(instructorCell.style.display).toBe("table-cell");
    expect(instructorCell.style.flexWrap).toBe("");
  });

  it("preserves original Albert instructor links when wrapping processed cell content", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" aria-label="Instructor">
          <a id="instructor-link" href="/instructor/details" data-action="open-profile">Ada Lovelace</a>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    const instructorCell = document.getElementById("grid-instructor");
    const originalContent = instructorCell.querySelector(":scope > .nyu-rmp-albert-original");
    const link = originalContent.querySelector("#instructor-link");
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/instructor/details");
    expect(link.dataset.action).toBe("open-profile");
    expect(link.textContent.trim()).toBe("Ada Lovelace");

    removeAlbertRmpEnhancements(document);

    expect(instructorCell.querySelector(":scope > #instructor-link")).toBe(link);
    expect(instructorCell.querySelector(".nyu-rmp-albert-original")).toBeNull();
    expect(instructorCell.querySelector(".nyu-rmp-rating-root")).toBeNull();
  });

  it("wraps processed cell content without relying on the global Node constructor", async () => {
    document.body.innerHTML = `
      <div role="row">
        <div role="gridcell" id="grid-instructor" aria-label="Instructor">YAP, CHEE KENG</div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);
    const originalNode = globalThis.Node;

    try {
      globalThis.Node = undefined;

      await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);
    } finally {
      globalThis.Node = originalNode;
    }

    const instructorCell = document.getElementById("grid-instructor");
    expect(instructorCell.querySelector(":scope > .nyu-rmp-albert-original").textContent.trim()).toBe("YAP, CHEE KENG");
    expect(instructorCell.querySelector(":scope > .nyu-rmp-rating-root.is-cell-mounted")).not.toBeNull();
  });

  it("injects one rating card for each adjacent-cell co-instructor", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor(s)</th>
            <td>Grace B. Hopper; Alan Turing</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: name === "Grace B. Hopper" ? 4.9 : 4.6,
      difficulty: 3.1,
      ratingsCount: 27,
      wouldTakeAgain: 88.4,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(lookupProfessor).toHaveBeenCalledWith("Alan Turing");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(document.body.textContent).toContain("Grace B. Hopper comment");
    expect(document.body.textContent).toContain("Alan Turing comment");
  });

  it("injects one rating card for each plus-separated adjacent-cell co-instructor", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor(s)</th>
            <td>Ada Lovelace + Grace B. Hopper</td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.3,
      difficulty: 2.2,
      ratingsCount: 18,
      topComments: [`${name} plus-separated comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Ada Lovelace");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Ada Lovelace + Grace B. Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(document.body.textContent).toContain("Ada Lovelace plus-separated comment");
    expect(document.body.textContent).toContain("Grace B. Hopper plus-separated comment");
  });

  it("parses adjacent-cell co-instructors split across Albert child rows", async () => {
    document.body.innerHTML = `
      <table>
        <tbody>
          <tr>
            <th>Instructor(s)</th>
            <td>
              <div>YAP, CHEE KENG</div>
              <div>Grace B. Hopper</div>
            </td>
          </tr>
        </tbody>
      </table>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.4,
      ratingsCount: 17,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(document.body.textContent).toContain("Chee Keng Yap comment");
    expect(document.body.textContent).toContain("Grace B. Hopper comment");
  });

  it("injects ratings when Albert puts names on lines after an instructor label", async () => {
    document.body.innerHTML = `
      <div>
        <span>Instructor(s):</span>
        <br>
        <span>YAP, CHEE KENG</span>
        <br>
        <span>Grace B. Hopper</span>
        <br>
        <span>Enrollment Requirement Group</span>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.4,
      ratingsCount: 17,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Enrollment Requirement Group");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("injects ratings when Albert abbreviates visible instructor labels", async () => {
    document.body.innerHTML = `
      <div>
        <span>Instr: YAP, CHEE KENG</span>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 2.8,
      ratingsCount: 24,
      topComments: [`${name} abbreviated label comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Chee Keng Yap abbreviated label comment");
  });

  it("injects one rating card for each plural abbreviated Albert instructor label", async () => {
    document.body.innerHTML = `
      <div>
        <span>Instr(s): YAP, CHEE KENG + Grace B. Hopper</span>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.2,
      difficulty: 2.6,
      ratingsCount: 31,
      topComments: [`${name} plural abbreviated label comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Grace B. Hopper");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
    expect(document.body.textContent).toContain("Chee Keng Yap plural abbreviated label comment");
    expect(document.body.textContent).toContain("Grace B. Hopper plural abbreviated label comment");
  });

  it("injects ratings when Albert abbreviates instructor-name labels", async () => {
    document.body.innerHTML = `
      <div>
        <span>Instr Name: YAP, CHEE KENG</span>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.4,
      difficulty: 2.5,
      ratingsCount: 28,
      topComments: [`${name} abbreviated name-label comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledTimes(1);
    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(document.body.textContent).toContain("Chee Keng Yap abbreviated name-label comment");
  });

  it("injects ratings when multiline Albert instructor labels omit the colon", async () => {
    document.body.innerHTML = `
      <div>
        <span>Instructor(s)</span>
        <br>
        <span>YAP, CHEE KENG</span>
        <br>
        <span>Alan Turing</span>
        <br>
        <span>Section Status Open</span>
      </div>
    `;
    const lookupProfessor = vi.fn(async (name) => ({
      name,
      rating: 4.1,
      difficulty: 3.4,
      ratingsCount: 17,
      tags: [],
      topComments: [`${name} comment`],
      url: "https://www.ratemyprofessors.com/",
    }));

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(lookupProfessor).toHaveBeenCalledWith("Chee Keng Yap");
    expect(lookupProfessor).toHaveBeenCalledWith("Alan Turing");
    expect(lookupProfessor).not.toHaveBeenCalledWith("Section Status Open");
    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(2);
  });

  it("prefers the most specific instructor node inside nested Albert containers", async () => {
    document.body.innerHTML = `
      <div class="course-wrapper">
        <div class="section-row">
          <span>Instructor: Ada Lovelace</span>
        </div>
      </div>
    `;
    const lookupProfessor = vi.fn(async () => null);

    await Promise.all(scanAlbertPageOnce({ document, lookupProfessor }).pendingLookups);

    expect(document.querySelectorAll(".nyu-rmp-card")).toHaveLength(1);
    expect(lookupProfessor).toHaveBeenCalledTimes(1);
  });
});

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}
