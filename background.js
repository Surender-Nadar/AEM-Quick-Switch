// This script runs in the background and listens for commands (keyboard shortcuts).

chrome.commands.onCommand.addListener((command) => {
    // A constant object to hold AEM environment configuration, including hostname patterns and base hostnames.
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
            'xf': '/aem/experience-fragments.html/content/experience-fragments',
            'dam': '/assets.html/content/dam',
            'sites': '/sites.html/content',
            'editor': '/editor.html',
            'props': '/mnt/overlay/wcm/core/content/sites/properties.html'
        },
        'classic': {
            'xf': '/siteadmin#/content/experience-fragments',
            'dam': '/damadmin#/content/dam',
            'sites': '/siteadmin#/content',
            'editor': '?wcmmode=classic'
        },
        'forms': {
            'touch': '/aem/forms.html/content/dam/formsanddocuments',
            'editor': '/editor.html/content/forms/af'
        }
    };
    
    // Main navigation function that builds a new URL and opens it in a new tab.
    function navigate(target, ui) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            const currentUrl = new URL(tab.url);
            const currentPath = currentUrl.pathname;

            let newUrl = '';

            // Logic for handling the 'View as Published' link.
            if (target === 'published') {
                if (currentPath.includes(PATH_CONFIG.forms.editor)) {
                    alert("Error: 'View as Published' is not applicable for Forms.");
                    return;
                }
                newUrl = `${currentUrl.origin}${currentPath}?wcmmode=disabled`;
            } else if (target === 'props') {
                // Logic for handling the 'Page Properties' link.
                const pagePath = currentPath.split('.html')[0].replace('/editor.html', '');
                newUrl = `${currentUrl.origin}${PATH_CONFIG.touch.props}?item=${pagePath}`;
            } else {
                // Logic for general navigation based on UI and target.
                const currentContentPath = extractContentPath(currentUrl);

                if (!currentContentPath) {
                    alert(`Could not find a valid content path to navigate to ${target}.`);
                    return;
                }

                const isForm = currentContentPath.includes('/content/forms/af/');

                if (isForm && target !== 'editor') {
                    alert(`Navigation to this destination is not supported from Forms page.`);
                    return;
                }

                let newContentPath = currentContentPath;
                if (target === 'editor' && isForm) {
                    const parts = currentContentPath.split('/');
                    parts.splice(3, 0, 'forms');
                    newContentPath = parts.join('/');
                }

                const targetPath = PATH_CONFIG[ui][target];
                if (ui === 'touch') {
                    newUrl = `${currentUrl.origin}${targetPath}${newContentPath}`;
                } else if (ui === 'classic') {
                    newUrl = `${currentUrl.origin}${targetPath}${newContentPath.split('.html')[0]}`;
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

    // Helper function to extract the content path from a URL.
    function extractContentPath(url) {
        let path = url.pathname;
        const patterns = [
            /^\/(aem|editor|siteadmin|damadmin|assets|sites)\.html\/(.*)/,
            /^\/(.*)\?wcmmode=disabled/
        ];

        for (const pattern of patterns) {
            const match = path.match(pattern);
            if (match && match[2]) {
                return '/' + match[2];
            }
        }

        if (path.startsWith('/content/')) {
            return path;
        }

        return null;
    }

    // Listen for commands from the manifest and call the appropriate function.
    switch (command) {
        case "go-to-xf":
            navigate('xf', 'touch');
            break;
        case "go-to-dam":
            navigate('dam', 'touch');
            break;
        case "go-to-sites":
            navigate('sites', 'touch');
            break;
        case "go-to-page-properties":
            navigate('props', 'touch');
            break;
        case "view-as-published":
            navigate('published', 'touch');
            break;
        case "go-to-classic-ui":
            navigate('sites', 'classic');
            break;
        case "go-to-editor":
            navigate('editor', 'touch');
            break;
        case "switch-environment":
            switchEnvironment();
            break;
        default:
            console.warn(`Unrecognized command: ${command}`);
    }
});