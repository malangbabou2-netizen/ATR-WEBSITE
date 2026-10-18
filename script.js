const campaignDakarClock = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dakar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
});

const getDakarMidnightTimestamp = (year, month, day) => {
    const targetAsUtc = Date.UTC(year, month - 1, day);
    let timestamp = targetAsUtc;

    for (let attempt = 0; attempt < 3; attempt += 1) {
        const parts = Object.fromEntries(
            campaignDakarClock.formatToParts(new Date(timestamp))
                .filter((part) => part.type !== 'literal')
                .map((part) => [part.type, Number(part.value)])
        );
        const observedAsUtc = Date.UTC(
            parts.year,
            parts.month - 1,
            parts.day,
            parts.hour,
            parts.minute,
            parts.second
        );
        const adjustment = targetAsUtc - observedAsUtc;
        timestamp += adjustment;
        if (adjustment === 0) break;
    }

    return timestamp;
};

const octoberRoseStart = getDakarMidnightTimestamp(2026, 10, 10);
// Campagne temporaire : fin exclusive le 1er novembre 2026 à minuit Dakar.
// Ensuite, le Hero original (images/hero-ATR.jpg) reste le secours permanent ;
// seules les bannières CMS éligibles peuvent le remplacer.
const octoberRoseEnd = getDakarMidnightTimestamp(2026, 11, 1);
const campaignHero = document.querySelector('.hero');
const campaignArtwork = document.querySelector('.hero-campaign');
const campaignActions = document.querySelector('.hero-campaign-actions');
const heroContent = campaignHero?.querySelector('.hero-content');
const heroButtons = heroContent?.querySelector('.hero-buttons');
let heroCampaignTimer;

function updateHeroCampaign() {
    if (!campaignHero || !campaignArtwork || !campaignActions || !heroContent || !heroButtons) return;
    const now = Date.now();
    const isActive = now >= octoberRoseStart && now < octoberRoseEnd;
    campaignHero.classList.toggle('hero--october-rose', isActive);
    campaignArtwork.hidden = !isActive;
    if (isActive && heroButtons.parentElement !== campaignActions) {
        campaignActions.appendChild(heroButtons);
    } else if (!isActive && heroButtons.parentElement !== heroContent) {
        heroContent.appendChild(heroButtons);
    }
    clearTimeout(heroCampaignTimer);
    const nextBoundary = now < octoberRoseStart ? octoberRoseStart : octoberRoseEnd;
    if (now < nextBoundary) {
        // Recheck daily to stay within browser timer limits, then at the exact boundary.
        heroCampaignTimer = setTimeout(updateHeroCampaign, Math.min(nextBoundary - now, 86400000));
    }
}
updateHeroCampaign();
document.addEventListener('visibilitychange', updateHeroCampaign);
window.addEventListener('pageshow', updateHeroCampaign);

const adventureStatusLabels = {
    fr: { upcoming: 'À venir', ongoing: 'En cours', completed: 'Terminée' }
};

const menuButton = document.querySelector('#menuButton');
const navigation = document.querySelector('.navigation');

if (menuButton && navigation) {
    const setMenuOpen = (isOpen) => {
        navigation.classList.toggle('is-open', isOpen);
        menuButton.setAttribute('aria-expanded', String(isOpen));
        const labels = { open: 'Ouvrir le menu', close: 'Fermer le menu' };
        menuButton.setAttribute('aria-label', isOpen ? labels.close : labels.open);
    };

    menuButton.addEventListener('click', () => {
        setMenuOpen(menuButton.getAttribute('aria-expanded') !== 'true');
    });

    navigation.querySelectorAll('a').forEach((link) => {
        link.addEventListener('click', () => {
            setMenuOpen(false);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && navigation.classList.contains('is-open')) {
            setMenuOpen(false);
            menuButton.focus();
        }
    });
}

const memberAdventureList = document.querySelector('#memberAdventureList');
const memberAdventureArchive = document.querySelector('#memberAdventureArchive');
const adventureEmptyState = document.querySelector('#adventureEmptyState');
const adventureProposalPanel = document.querySelector('#adventure-proposal-panel');
const proposalToggles = document.querySelectorAll('[data-proposal-toggle]');

if (memberAdventureList && memberAdventureArchive && adventureEmptyState && adventureProposalPanel) {
    let dakarMidnightTimer;

    const dakarDateTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Africa/Dakar',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    });

    const getDakarDateTimeParts = (date) => {
        const parts = Object.fromEntries(
            dakarDateTime.formatToParts(date)
                .filter((part) => part.type !== 'literal')
                .map((part) => [part.type, Number(part.value)])
        );

        return parts;
    };

    const getDakarDateKey = (date) => {
        const parts = getDakarDateTimeParts(date);
        return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
    };

    const getDakarMidnightTimestamp = (year, month, day) => {
        const targetAsUtc = Date.UTC(year, month - 1, day);
        let timestamp = targetAsUtc;

        for (let attempt = 0; attempt < 3; attempt += 1) {
            const parts = getDakarDateTimeParts(new Date(timestamp));
            const observedAsUtc = Date.UTC(
                parts.year,
                parts.month - 1,
                parts.day,
                parts.hour,
                parts.minute,
                parts.second
            );
            const adjustment = targetAsUtc - observedAsUtc;

            timestamp += adjustment;

            if (adjustment === 0) {
                break;
            }
        }

        return timestamp;
    };

    const updateAdventureStatuses = () => {
        const today = getDakarDateKey(new Date());
        let activeCount = 0;

        document.querySelectorAll('[data-adventure]').forEach((adventure) => {
            const { startDate, endDate } = adventure.dataset;
            const status = today < startDate
                ? 'upcoming'
                : today <= endDate
                    ? 'ongoing'
                    : 'completed';

            adventure.dataset.status = status;
            if (status === 'completed') {
                memberAdventureArchive.append(adventure);
            } else {
                memberAdventureList.append(adventure);
            }

            const statusAnnouncement = adventure.querySelector('[data-adventure-status]');
            if (statusAnnouncement) {
                statusAnnouncement.textContent = `Statut : ${adventureStatusLabels.fr[status]}`;
            }

            if (status !== 'completed') {
                activeCount += 1;
            }
        });

        adventureEmptyState.hidden = activeCount > 0;

        document.querySelectorAll('.adventure-proposal-toggle').forEach((toggle) => {
            toggle.hidden = activeCount === 0 && toggle.closest('.section-heading') !== null;
        });
    };

    const scheduleNextDakarMidnight = () => {
        window.clearTimeout(dakarMidnightTimer);

        const now = new Date();
        const today = getDakarDateTimeParts(now);
        const tomorrow = new Date(Date.UTC(today.year, today.month - 1, today.day + 1));
        const nextMidnight = getDakarMidnightTimestamp(
            tomorrow.getUTCFullYear(),
            tomorrow.getUTCMonth() + 1,
            tomorrow.getUTCDate()
        );
        const delay = Math.max(100, nextMidnight - now.getTime() + 50);

        dakarMidnightTimer = window.setTimeout(() => {
            updateAdventureStatuses();
            scheduleNextDakarMidnight();
        }, delay);
    };

    const openProposalPanel = () => {
        adventureProposalPanel.hidden = false;
        proposalToggles.forEach((toggle) => toggle.setAttribute('aria-expanded', 'true'));
        adventureProposalPanel.scrollIntoView({ block: 'start' });
        adventureProposalPanel.querySelector('input')?.focus({ preventScroll: true });
    };

    proposalToggles.forEach((toggle) => {
        toggle.addEventListener('click', openProposalPanel);
    });

    const refreshAdventureStatuses = () => {
        updateAdventureStatuses();
        scheduleNextDakarMidnight();
    };

    refreshAdventureStatuses();
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            refreshAdventureStatuses();
        }
    });
    window.addEventListener('focus', refreshAdventureStatuses);
}

// Renseigner ici uniquement les URL officielles ATR quand elles auront été validées.
const atrSocialProfileUrls = {
    youtube: '',
    instagram: 'https://www.instagram.com/africatwin221/',
    facebook: ''
};

const atrSocialProfileLabels = {
    youtube: 'YouTube',
    instagram: 'Instagram',
    facebook: 'Facebook'
};

document.querySelectorAll('[data-social-platform]').forEach((icon) => {
    const platform = icon.dataset.socialPlatform;
    const url = atrSocialProfileUrls[platform]?.trim();

    if (!url) {
        return;
    }

    const link = document.createElement('a');
    link.className = icon.className;
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.socialPlatform = platform;
    link.setAttribute('aria-label', `${atrSocialProfileLabels[platform]} — lien officiel ATR`);
    link.append(icon.querySelector('svg').cloneNode(true));
    icon.replaceWith(link);
});

// Les anciennes préférences anglaises ne doivent plus changer la langue du site.
document.documentElement.lang = 'fr';
try {
    localStorage.setItem('atr-language', 'fr');
} catch {
    // Le site reste en français si le stockage local est indisponible.
}
