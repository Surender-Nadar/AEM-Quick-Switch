// This script runs in the background and listens for commands (keyboard shortcuts).

chrome.commands.onCommand.addListener((command) => {
    // A constant object to hold AEM environment configuration
    const ENVIRONMENT_CONFIG = {
        'qa': {
            'patterns': ['author-astellas-qa-65.adobecqms.net', 'author1apnortheast1-b80.qa.astellas.adobecqms.net', '18.180.111.160'],
            'hostnames': {
                'b65': 'https://author-astellas-qa-65.adobecqms.net',
                'b80': 'https://author1apnortheast1-b80.qa.astellas.adobecqms.net',
                'ip': 'https://18.180.111.160'
            }
        },
        'prod': {
            'patterns': ['author-astellas-prod-65.adobecqms.net', 'author1useast1-b80.prod-65.astellas.adobecqms.net', '54.243.158.24'],
            'hostnames': {
                'b65': 'https://author-astellas-prod-65.adobecqms.net',
                'b80': 'https://author1useast1-b80.prod-65.astellas.adobecqms.net',
                'ip': 'https://54.243.158.24'
            }
        }
    };

    // A constant object to hold the relative paths for AEM navigation.
    const PATH_CONFIG = {
        'touch': {
            'xf': '/aem/experience-fragments.html',
            'dam': '/assets.html',
            'sites': '/sites.html',
            'editor': '/editor.html',
            'props': '/mnt/overlay/wcm/core/content/sites/properties.html',
            'forms': '/aem/forms.html/content/dam/formsanddocuments'
        },
        'classic': {
            'xf': '/siteadmin#/content/experience-fragments',
            'dam': '/damadmin#/content/dam',
            'sites': '/siteadmin#/content',
            'editor': '?wcmmode=classic' // Note: Classic editor for pages is special
        }
    };

    // Helper to extract the core content path from a URL
    function extractContentPath(url) {
        const path = url.pathname;
        const patterns = [
            /^\/(editor|sites|siteadmin|damadmin|assets|aem\/experience-fragments|aem\/forms)\.html(\/content\/.*)/,
            /^\/(content\/.*)/ // Fallback for direct content paths like from wcmmode=disabled
        ];

        for (const pattern of patterns) {
            const match = path.match(pattern);
            if (match && match[2]) return match[2]; // For paths like /editor.html/content/...
            if (match && match[1]) return match[1]; // For paths like /content/...
        }
        return null;
    }

    // Main navigation function
    function navigate(target) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const currentUrl = new URL(tab.url);
            const origin = currentUrl.origin;
            let newUrl = '';

            const contentPath = extractContentPath(currentUrl);
            if (!contentPath && !['published', 'props', 'forms'].includes(target)) {
                alert('Could not determine a valid AEM content path from the current URL.');
                return;
            }

            const pathWithoutPage = contentPath ? contentPath.substring(0, contentPath.lastIndexOf('/')) : '';
            const projectPath = pathWithoutPage.replace('/content/', '');

            switch (target) {
                case 'sites':
                    newUrl = `${origin}${PATH_CONFIG.touch.sites}${pathWithoutPage}`;
                    break;
                case 'dam':
                    newUrl = `${origin}${PATH_CONFIG.touch.dam}/content/dam/${projectPath}`;
                    break;
                case 'xf':
                    newUrl = `${origin}${PATH_CONFIG.touch.xf}/content/experience-fragments/${projectPath}/site`;
                    break;
                case 'forms':
                    newUrl = `${origin}${PATH_CONFIG.touch.forms}`;
                    break;
                case 'editor':
                    newUrl = `${origin}${PATH_CONFIG.touch.editor}${contentPath}`;
                    break;
                case 'props':
                    const pagePathForProps = currentUrl.pathname.split('.html')[0].replace('/editor.html', '');
                    newUrl = `${origin}${PATH_CONFIG.touch.props}?item=${pagePathForProps}`;
                    break;
                case 'published':
                    // Fix for wcmmode=disabled
                    const publishedPath = currentUrl.pathname.replace('/editor.html', '');
                    newUrl = `${origin}${publishedPath}?wcmmode=disabled`;
                    break;
            }

            if (newUrl) {
                chrome.tabs.update(tab.id, { url: newUrl });
            }
        });
    }

    // Function to toggle between Classic and Touch UI
    function toggleUi() {
         chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const currentUrl = new URL(tab.url);
            const origin = currentUrl.origin;
            const path = currentUrl.pathname;
            let newUrl = '';

            const contentPath = extractContentPath(currentUrl) || '/';
            const contentPathNoHtml = contentPath.split('.html')[0];

            // Detect current state and switch
            if (path.includes('/siteadmin') || path.includes('/damadmin')) { // From Classic to Touch
                if (path.startsWith('/siteadmin')) {
                    newUrl = `${origin}${PATH_CONFIG.touch.sites}${contentPathNoHtml}`;
                } else if (path.startsWith('/damadmin')) {
                    newUrl = `${origin}${PATH_CONFIG.touch.dam}${contentPathNoHtml}`;
                }
            } else { // From Touch to Classic
                if (path.startsWith('/sites.html')) {
                    newUrl = `${origin}${PATH_CONFIG.classic.sites}${contentPathNoHtml}`;
                } else if (path.startsWith('/assets.html')) {
                    newUrl = `${origin}${PATH_CONFIG.classic.dam}${contentPathNoHtml.replace('/content/dam','')}`;
                } else if (path.startsWith('/aem/experience-fragments.html')) {
                     newUrl = `${origin}${PATH_CONFIG.classic.xf}${contentPathNoHtml.replace('/content/experience-fragments','')}`;
                } else if (path.startsWith('/editor.html')) {
                    newUrl = `${origin}${contentPath}?wcmmode=classic`;
                } else {
                    alert('UI Toggle is only available in Sites, DAM, XF, or Editor view.');
                }
            }

            if (newUrl) {
                chrome.tabs.update(tab.id, { url: newUrl });
            }
        });
    }


    // Function to switch between QA and Prod environments.
    function switchEnvironment() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const currentUrl = new URL(tab.url);

            const currentEnv = Object.keys(ENVIRONMENT_CONFIG).find(env =>
                ENVIRONMENT_CONFIG[env].patterns.some(pattern => currentUrl.hostname.includes(pattern))
            );

            if (!currentEnv) {
                alert('AEM environment not detected.');
                return;
            }

            const targetEnv = currentEnv === 'qa' ? 'prod' : 'qa';
            const currentInstance = Object.keys(ENVIRONMENT_CONFIG[currentEnv].hostnames).find(instance =>
                currentUrl.hostname.includes(ENVIRONMENT_CONFIG[currentEnv].hostnames[instance].replace('https://', ''))
            );

            if (!currentInstance) {
                alert('AEM instance not detected.');
                return;
            }

            const newHostname = ENVIRONMENT_CONFIG[targetEnv].hostnames[currentInstance];
            const newUrl = currentUrl.href.replace(currentUrl.origin, newHostname);
            
            chrome.tabs.update(tab.id, { url: newUrl });
        });
    }

    // Command listener switch
    switch (command) {
        case "go-to-xf":
            navigate('xf');
            break;
        case "go-to-dam":
            navigate('dam');
            break;
        case "go-to-sites":
            navigate('sites');
            break;
        case "go-to-forms":
            navigate('forms');
            break;
        case "go-to-page-properties":
            navigate('props');
            break;
        case "view-as-published":
            navigate('published');
            break;
        case "go-to-editor":
            navigate('editor');
            break;
        case "toggle-ui":
            toggleUi();
            break;
        case "switch-environment":
            switchEnvironment();
            break;
        default:
            console.warn(`Unrecognized command: ${command}`);
    }
});