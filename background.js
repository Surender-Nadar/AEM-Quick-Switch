// AEM SWIFT NAV - Background Service Worker

const ENVIRONMENT_CONFIG = {
  qa: {
    patterns: [
      "author-astellas-qa-65.adobecqms.net",
      "author1apnortheast1-b80.qa.astellas.adobecqms.net",
      "18.180.111.160",
    ],
    hostnames: {
      "qa-65": "https://author-astellas-qa-65.adobecqms.net",
      b80: "https://author1apnortheast1-b80.qa.astellas.adobecqms.net",
      ip: "https://18.180.111.160",
    },
  },
  prod: {
    patterns: [
      "author-astellas-prod-65.adobecqms.net",
      "author1useast1-b80.prod-65.astellas.adobecqms.net",
      "54.243.158.24",
    ],
    hostnames: {
      "prod-65": "https://author-astellas-prod-65.adobecqms.net",
      b80: "https://author1useast1-b80.prod-65.astellas.adobecqms.net",
      ip: "https://54.243.158.24",
    },
  },
};

const PATH_CONFIG = {
  touch: {
    xf: "/aem/experience-fragments.html",
    dam: "/assets.html",
    sites: "/sites.html",
    editor: "/editor.html",
    props: "/mnt/overlay/wcm/core/content/sites/properties.html",
    forms: "/aem/forms.html/content/dam/formsanddocuments",
  },
  classic: {
    xf: "/siteadmin#/content/experience-fragments",
    dam: "/damadmin#/content/dam",
    sites: "/siteadmin#/content",
    editor: "?wcmmode=classic",
  },
};

// --- Helper Functions ---
function extractContentPath(url) {
  const path = url.pathname;
  const search = url.search;
  if (search.includes("wcmmode=disabled")) {
    return path;
  }
  const patterns = [
    /^\/(editor|sites|siteadmin|damadmin|assets|aem\/experience-fragments|aem\/forms)\.html(\/content\/.*)/,
    /^\/(content\/.*)/,
  ];
  for (const pattern of patterns) {
    const match = path.match(pattern);
    if (match && match[2]) return match[2];
    if (match && match[1]) return match[1];
  }
  return null;
}

function openInNextTab(url, currentTab) {
  chrome.tabs.create({ url: url, index: currentTab.index + 1 });
}

// --- Core Logic ---
function navigate(target, tab) {
  const currentUrl = new URL(tab.url);
  const origin = currentUrl.origin;
  let newUrl = "";

  if (target === "forms") {
    chrome.scripting.executeScript(
      {
        target: { tabId: tab.id },
        func: () =>
          document.querySelector(".guideContainerNode")?.dataset
            .repositoryPath || null,
      },
      (results) => {
        const formPath = results[0].result;
        newUrl = formPath
          ? `${origin}${PATH_CONFIG.touch.editor}${formPath}`
          : `${origin}${PATH_CONFIG.touch.forms}`;
        openInNextTab(newUrl, tab);
      }
    );
    return;
  }

  const contentPath = extractContentPath(currentUrl);
  if (!contentPath && !["published", "props", "editor"].includes(target)) {
    alert("Could not determine a valid AEM content path.");
    return;
  }

  const pathWithoutPage = contentPath
    ? contentPath.substring(0, contentPath.lastIndexOf("/"))
    : "";
  const projectPath = pathWithoutPage.replace("/content/", "");

  switch (target) {
    case "sites":
      newUrl = `${origin}${PATH_CONFIG.touch.sites}${pathWithoutPage}`;
      break;
    case "dam":
      newUrl = `${origin}${PATH_CONFIG.touch.dam}/content/dam/${projectPath}`;
      break;
    case "xf":
      newUrl = `${origin}${PATH_CONFIG.touch.xf}/content/experience-fragments/${projectPath}/site`;
      break;
    case "editor":
      newUrl = `${origin}${PATH_CONFIG.touch.editor}${contentPath}`;
      break;
    case "props":
      newUrl = `${origin}${PATH_CONFIG.touch.props}?item=${
        contentPath.split(".html")[0]
      }`;
      break;
    case "published":
      newUrl = `${origin}${contentPath}?wcmmode=disabled`;
      break;
  }

  if (newUrl) openInNextTab(newUrl, tab);
}

function toggleUi(tab) {
  const currentUrl = new URL(tab.url);
  const origin = currentUrl.origin;
  const path = currentUrl.pathname;
  let newUrl = "";

  const contentPath = path.includes("#")
    ? path.split("#")[1]
    : extractContentPath(currentUrl) || "/";
  const contentPathNoHtml = contentPath.split(".html")[0];

  if (path.includes("/siteadmin") || path.includes("/damadmin")) {
    // From Classic
    if (path.startsWith("/siteadmin"))
      newUrl = `${origin}${PATH_CONFIG.touch.sites}${contentPathNoHtml}`;
    else if (path.startsWith("/damadmin"))
      newUrl = `${origin}${PATH_CONFIG.touch.dam}${contentPathNoHtml}`;
  } else {
    // From Touch
    if (path.startsWith("/sites.html"))
      newUrl = `${origin}${
        PATH_CONFIG.classic.sites
      }${contentPathNoHtml.replace("/content", "")}`;
    else if (path.startsWith("/assets.html"))
      newUrl = `${origin}${PATH_CONFIG.classic.dam}${contentPathNoHtml.replace(
        "/content/dam",
        ""
      )}`;
    else if (path.startsWith("/aem/experience-fragments.html"))
      newUrl = `${origin}${PATH_CONFIG.classic.xf}${contentPathNoHtml.replace(
        "/content/experience-fragments",
        ""
      )}`;
    else if (path.startsWith("/editor.html"))
      newUrl = `${origin}${contentPath}?wcmmode=classic`;
    else
      alert("UI Toggle is only available in Sites, DAM, XF, or Editor view.");
  }

  if (newUrl) openInNextTab(newUrl, tab);
}

function switchEnvironment(tab) {
  const currentUrl = new URL(tab.url);
  const currentEnv = Object.keys(ENVIRONMENT_CONFIG).find((env) =>
    ENVIRONMENT_CONFIG[env].patterns.some((p) =>
      currentUrl.hostname.includes(p)
    )
  );
  if (!currentEnv) {
    alert("AEM environment not detected.");
    return;
  }

  const targetEnv = currentEnv === "qa" ? "prod" : "qa";
  const currentInstanceKey = Object.keys(
    ENVIRONMENT_CONFIG[currentEnv].hostnames
  ).find(
    (key) => currentUrl.origin === ENVIRONMENT_CONFIG[currentEnv].hostnames[key]
  );

  if (!currentInstanceKey) {
    alert("AEM instance not detected.");
    return;
  }

  const newHostname =
    ENVIRONMENT_CONFIG[targetEnv].hostnames[currentInstanceKey];
  const newUrl = currentUrl.href.replace(currentUrl.origin, newHostname);
  openInNextTab(newUrl, tab);
}

// --- Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.command === "openUrl" && request.url) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) =>
      openInNextTab(request.url, tabs[0])
    );
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  const isAEMEnv = [
    ...ENVIRONMENT_CONFIG.qa.patterns,
    ...ENVIRONMENT_CONFIG.prod.patterns,
  ].some((p) => tab.url.includes(p));
  if (!isAEMEnv) return;

  chrome.storage.local.get(["extensionEnabled"], (result) => {
    if (result.extensionEnabled !== false) {
      const commands = {
        "go-to-xf": () => navigate("xf", tab),
        "go-to-dam": () => navigate("dam", tab),
        "go-to-sites": () => navigate("sites", tab),
        "go-to-forms": () => navigate("forms", tab),
        "go-to-page-properties": () => navigate("props", tab),
        "view-as-published": () => navigate("published", tab),
        "go-to-editor": () => navigate("editor", tab),
        "toggle-ui": () => toggleUi(tab),
        "switch-environment": () => switchEnvironment(tab),
      };
      if (commands[command]) commands[command]();
    }
  });
});
