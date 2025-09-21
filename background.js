// This script runs in the background and handles all core logic.

const ENVIRONMENT_CONFIG = {
    'qa': {
        'patterns': ['author-astellas-qa-65.adobecqms.net', 'author1apnortheast1-b80.qa.astellas.adobecqms.net', '18.180.111.160'],
        'hostnames': {
            'qa-65': 'https://author-astellas-qa-65.adobecqms.net',
            'b80': 'https://author1apnortheast1-b80.qa.astellas.adobecqms.net',
            'ip': 'https://18.180.111.160'
        }
    },
    'prod': {
        'patterns': ['author-astellas-prod-65.adobecqms.net', 'author1useast1-b80.prod-65.astellas.adobecqms.net', '54.243.158.24'],
        'hostnames': {
            'prod-65': 'https://author-astellas-prod-65.adobecqms.net',
            'b80': 'https://author1useast1-b80.prod-65.astellas.adobecqms.net',
            'ip': 'https://54.243.158.24'
        }
    }
};

const PATH_CONFIG = {
    'touch': {
        'xf': '/aem/experience-fragments.html', 'dam': '/assets.html',
        'sites': '/sites.html', 'editor': '/editor.html',
        'props': '/mnt/overlay/wcm/core/content/sites/properties.html',
        'forms': '/aem/forms.html/content/dam/formsanddocuments'
    },
    'classic': {
        'xf': '/siteadmin#/content/experience-fragments', 'dam': '/damadmin#/content/dam',
        'sites': '/siteadmin#/content', 'editor': '?wcmmode=classic'
    }
};

// --- Helper Functions ---
function extractContentPath(url) {
    const path = url.pathname;
    const patterns = [
        /^\/(editor|sites|siteadmin|damadmin|assets|aem\/experience-fragments|aem\/forms)\.html(\/content\/.*)/,
        /^\/(content\/.*)/
    ];
    for (const pattern of patterns) {
        const match = path.match(pattern);
        if (match && match[2]) return match[2];
        if (match && match[1]) return match[1];
    }
    return null;
}

function openInNextTab(url, currentTabId) {
    chrome.tabs.get(currentTabId, (tab) => {
        chrome.tabs.create({ url: url, index: tab.index + 1 });
    });
}

// --- Core Logic Functions ---
function navigate(target) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        const currentUrl = new URL(tab.url);
        const origin = currentUrl.origin;
        let newUrl = '';

        // Intelligent Forms Logic
        if (target === 'forms') {
            chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: () => {
                    const formContainer = document.querySelector('.guideContainerNode');
                    return formContainer ? formContainer.dataset.repositoryPath : null;
                }
            }, (injectionResults) => {
                const formPath = injectionResults[0].result;
                if (formPath) {
                    newUrl = `${origin}${PATH_CONFIG.touch.editor}${formPath}`;
                } else {
                    newUrl = `${origin}${PATH_CONFIG.touch.forms}`;
                }
                openInNextTab(newUrl, tab.id);
            });
            return; // Exit early as the logic is async
        }

        const contentPath = extractContentPath(currentUrl);
        if (!contentPath && !['published', 'props'].includes(target)) {
            alert('Could not determine a valid AEM content path.');
            return;
        }

        const pathWithoutPage = contentPath ? contentPath.substring(0, contentPath.lastIndexOf('/')) : '';
        const projectPath = pathWithoutPage.replace('/content/', '');

        switch (target) {
            case 'sites': newUrl = `${origin}${PATH_CONFIG.touch.sites}${pathWithoutPage}`; break;
            case 'dam': newUrl = `${origin}${PATH_CONFIG.touch.dam}/content/dam/${projectPath}`; break;
            case 'xf': newUrl = `${origin}${PATH_CONFIG.touch.xf}/content/experience-fragments/${projectPath}/site`; break;
            case 'editor': newUrl = `${origin}${PATH_CONFIG.touch.editor}${contentPath}`; break;
            case 'props':
                const pagePathForProps = currentUrl.pathname.split('.html')[0].replace('/editor.html', '');
                newUrl = `${origin}${PATH_CONFIG.touch.props}?item=${pagePathForProps}`;
                break;
            case 'published':
                const publishedPath = currentUrl.pathname.replace('/editor.html', '');
                newUrl = `${origin}${publishedPath}?wcmmode=disabled`;
                break;
        }

        if (newUrl) {
            openInNextTab(newUrl, tab.id);
        }
    });
}

function toggleUi() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        const currentUrl = new URL(tab.url);
        const origin = currentUrl.origin;
        const path = currentUrl.pathname;
        let newUrl = '';

        // Bug Fix: Preserve full path when toggling from Classic to Touch
        const contentPath = path.includes('/siteadmin#') ? path.split('#')[1] : extractContentPath(currentUrl) || '/';
        const contentPathNoHtml = contentPath.split('.html')[0];

        if (path.includes('/siteadmin') || path.includes('/damadmin')) { // From Classic
            if (path.startsWith('/siteadmin')) {
                newUrl = `${origin}${PATH_CONFIG.touch.sites}${contentPathNoHtml}`;
            } else if (path.startsWith('/damadmin')) {
                newUrl = `${origin}${PATH_CONFIG.touch.dam}${contentPathNoHtml}`;
            }
        } else { // From Touch
            if (path.startsWith('/sites.html')) newUrl = `${origin}${PATH_CONFIG.classic.sites}${contentPathNoHtml}`;
            else if (path.startsWith('/assets.html')) newUrl = `${origin}${PATH_CONFIG.classic.dam}${contentPathNoHtml.replace('/content/dam','')}`;
            else if (path.startsWith('/aem/experience-fragments.html')) newUrl = `${origin}${PATH_CONFIG.classic.xf}${contentPathNoHtml.replace('/content/experience-fragments','')}`;
            else if (path.startsWith('/editor.html')) newUrl = `${origin}${contentPath}?wcmmode=classic`;
            else alert('UI Toggle is only available in Sites, DAM, XF, or Editor view.');
        }

        if (newUrl) {
            openInNextTab(newUrl, tab.id);
        }
    });
}

function switchEnvironment() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        const currentUrl = new URL(tab.url);
        const currentEnv = Object.keys(ENVIRONMENT_CONFIG).find(env =>
            ENVIRONMENT_CONFIG[env].patterns.some(pattern => currentUrl.hostname.includes(pattern))
        );
        if (!currentEnv) { alert('AEM environment not detected.'); return; }
        const targetEnv = currentEnv === 'qa' ? 'prod' : 'qa';
        const currentInstance = Object.keys(ENVIRONMENT_CONFIG[currentEnv].hostnames).find(instance =>
            currentUrl.hostname.includes(ENVIRONMENT_CONFIG[currentEnv].hostnames[instance].replace('https://', ''))
        );
        if (!currentInstance) { alert('AEM instance not detected.'); return; }
        const newHostname = ENVIRONMENT_CONFIG[targetEnv].hostnames[currentInstance];
        const newUrl = currentUrl.href.replace(currentUrl.origin, newHostname);
        openInNextTab(newUrl, tab.id);
    });
}

// --- Message & Command Listeners ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.command === 'openUrl') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            openInNextTab(request.url, tabs[0].id);
        });
    }
});

chrome.commands.onCommand.addListener((command) => {
    chrome.storage.local.get(['extensionEnabled'], (result) => {
        if (result.extensionEnabled !== false) { // Enabled by default
            switch (command) {
                case "go-to-xf": navigate('xf'); break;
                case "go-to-dam": navigate('dam'); break;
                case "go-to-sites": navigate('sites'); break;
                case "go-to-forms": navigate('forms'); break;
                case "go-to-page-properties": navigate('props'); break;
                case "view-as-published": navigate('published'); break;
                case "go-to-editor": navigate('editor'); break;
                case "toggle-ui": toggleUi(); break;
                case "switch-environment": switchEnvironment(); break;
                default: console.warn(`Unrecognized command: ${command}`);
            }
        }
    });
});