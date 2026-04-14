/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND COMPLETE
 */

const API_URL = "https://script.google.com/macros/s/AKfycbxkRhcfFKMPlLmCFAItNSr0g1G8vz4qygXet4u9vMa8NKSOfB9epUyzhwZMdcKSDlyM/exec"; 
const DATE_COUSINADE = new Date("2026-05-09T12:00:00");

let plats = [];
let commentaires = [];
let listeParticipants = []; 
let idEnEditionModale = null; // Utilisé pour les plats et le livre d'or
let platEnEditionModale = null; // Utilisé pour les convives

// Gestion de l'identifiant unique par navigateur
let browserId = localStorage.getItem('cousinade_id') || ('user_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('cousinade_id', browserId);

// Lancement au chargement
window.onload = () => {
    chargerDonnees();
    mettreAJourCompteARebours();
    setInterval(mettreAJourCompteARebours, 60000);
};

// --- 1. CHARGEMENT & AFFICHAGE GLOBAL ---

async function chargerDonnees() {
    try {
        const [resPlats, resComs, resParts] = await Promise.all([
            fetch(`${API_URL}?action=getPlats&t=${Date.now()}`),
            fetch(`${API_URL}?action=getCommentaires&t=${Date.now()}`),
            fetch(`${API_URL}?action=getParticipants&t=${Date.now()}`)
        ]);

        plats = await resPlats.json();
        commentaires = await resComs.json();
        listeParticipants = await resParts.json();

        renderAll();
    } catch (e) { console.error("Erreur chargement:", e); }
}

function renderAll() {
    afficherPlats();
    afficherLivreDor();
    calculerStatsGlobales();
    verifierSiDejaInscrit();
    afficherAllergies();
}

// --- 2. STATISTIQUES & LISTE DES PRÉSENTS ---

function calculerStatsGlobales() {
    let stats = { midi: 0, soir: 0, totalParts: 0, apero: 0, entree: 0, platPrincipal: 0, dessert: 0, autre: 0 };

    listeParticipants.forEach(p => {
        const nb = parseFloat(p.convives || 0);
        const estMidi = (p.midi === true || String(p.midi).toLowerCase() === "true");
        const estSoir = (p.soir === true || String(p.soir).toLowerCase() === "true");
        if (estMidi) stats.midi += nb;
        if (estSoir) stats.soir += nb;
    });

    plats.forEach(p => {
        if (p.plat && p.plat !== "null") {
            const nbParts = parseFloat(p.parts || 0);
            stats.totalParts += nbParts;
            if (stats.hasOwnProperty(p.categorie)) stats[p.categorie] += nbParts;
        }
    });

    const updateText = (id, val) => { if(document.getElementById(id)) document.getElementById(id).innerText = val; };
    updateText('stat-midi', stats.midi);
    updateText('stat-soir', stats.soir);
    updateText('stat-total', stats.totalParts);
    updateText('stat-apero', stats.apero);
    updateText('stat-entrees', stats.entree);
    updateText('stat-plats', stats.platPrincipal);
    updateText('stat-desserts', stats.dessert);

    const listeElem = document.getElementById('listePresents');
    if (listeElem) {
        listeElem.innerHTML = listeParticipants.map(p => {
            let labels = [];
            if (p.midi === true || String(p.midi).toLowerCase() === "true") labels.push("☀️M");
            if (p.soir === true || String(p.soir).toLowerCase() === "true") labels.push("🌙S");
            return `
                <div class="badge-present" style="background:white; padding:10px; border-radius:8px; margin:5px; display:inline-block; border:1px solid #feca57; min-width:120px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <strong>${p.nom}</strong> : ${p.convives}<br>
                    <small>${labels.join(' / ') || 'Présence à préciser'}</small>
                    ${p.ownerId === browserId ? `<button onclick="ouvrirModifConvivesDepuisPart('${p.ownerId}')" class="btn-edit-small">✏️</button>` : ''}
                </div>`;
        }).join('');
    }
}

// --- 3. INSCRIPTIONS & MODIFICATIONS ---

async function ajouterParticipant() {
    const btn = document.getElementById('btnInscrire');
    const nom = document.getElementById('nomPersonne').value.trim();
    let convivesInput = document.getElementById('nbConvives').value.replace(',', '.');
    const convives = parseFloat(convivesInput);
    const midi = document.getElementById('checkMidi').checked;
    const soir = document.getElementById('checkSoir').checked;
    const allergies = document.getElementById('allergieSaisieSeule').value.trim();

    if (!nom) return alert("Veuillez saisir votre prénom.");
    if (isNaN(convives) || convives <= 0) return alert("Indiquez le nombre de personnes.");
    if (!midi && !soir) return alert("Cochez au moins un repas.");

    btn.disabled = true;
    btn.innerText = "Inscription...";

    try {
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "insert", browserId, nom, convives, midi, soir, plat: "null", parts: 0, categorie: "autre", allergies }) 
        });
        await chargerDonnees();
        alert("C'est noté !");
    } catch (e) { alert("Erreur de connexion."); } 
    finally { btn.disabled = false; btn.innerText = "Valider ma présence"; }
}

function ouvrirModifConvivesDepuisPart(oId) {
    const p = listeParticipants.find(x => x.ownerId === oId);
    if (!p) return;
    platEnEditionModale = p;
    document.getElementById('titreModalConvives').innerText = p.nom;
    document.getElementById('editNbConvives').value = p.convives;
    document.getElementById('editCheckMidi').checked = (String(p.midi).toLowerCase() === "true");
    document.getElementById('editCheckSoir').checked = (String(p.soir).toLowerCase() === "true");
    document.getElementById('modalConvives').style.display = "block";
}

async function validerModifConvives() {
    const data = {
        action: "update",
        rowId: platEnEditionModale.id,
        browserId: browserId,
        nom: platEnEditionModale.nom,
        convives: document.getElementById('editNbConvives').value,
        midi: document.getElementById('editCheckMidi').checked,
        soir: document.getElementById('editCheckSoir').checked,
        plat: platEnEditionModale.plat || "null",
        parts: platEnEditionModale.parts || 0,
        categorie: platEnEditionModale.categorie || "autre",
        allergies: platEnEditionModale.allergies || ""
    };
    fermerModaleConvives();
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
    await chargerDonnees();
}

// --- 4. GESTION DES PLATS ---

function afficherPlats() {
    const cats = [['aperoListe', 'apero', '🍹'], ['entreeListe', 'entree', '🥗'], ['platListe', 'platPrincipal', '🥘'], ['dessertListe', 'dessert', '🍰'], ['autreListe', 'autre', '📦']];
    cats.forEach(([elemId, key, icon]) => {
        const list = plats.filter(p => p.categorie === key && p.plat && p.plat !== "null");
        const totalCat = list.reduce((s, p) => s + (parseFloat(p.parts) || 0), 0);
        const badge = document.getElementById(`total-${key}`);
        if(badge) { badge.innerText = totalCat; badge.style.display = totalCat > 0 ? "inline" : "none"; }

        document.getElementById(elemId).innerHTML = list.map(p => `
            <div class="plat-item" style="border-left-color: var(--${key})">
                <span>${icon} <strong>${p.nom}</strong><br>${p.plat} (${p.parts}p)</span>
                ${p.ownerId === browserId ? `
                    <div style="display:flex; gap:5px;">
                        <button onclick="ouvrirModifPlat(${p.id})" class="btn-action">✏️</button>
                        <button onclick="supprimerPlat(${p.id})" class="btn-action">🗑️</button>
                    </div>` : ''}
            </div>`).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Rien pour le moment</div>';
    });
}

async function ajouterPlat() {
    const nom = document.getElementById('nomPersonne').value.trim();
    const platNom = document.getElementById('nouveauPlat').value.trim();
    if (!nom) return alert("Saisissez votre prénom en haut.");
    if (!platNom) return alert("Quel plat apportez-vous ?");

    const fields = {
        action: "insert",
        browserId: browserId,
        nom: nom,
        plat: platNom,
        parts: document.getElementById('nombreParts').value || 0,
        categorie: document.querySelector('input[name="categoriePlat"]:checked').value,
        convives: document.getElementById('nbConvives').value || 0,
        midi: document.getElementById('checkMidi').checked,
        soir: document.getElementById('checkSoir').checked,
        allergies: document.getElementById('allergieSaisieSeule').value
    };

    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(fields) });
        annulerEdition();
        await chargerDonnees();
    } catch (e) { alert("Erreur ajout plat"); }
}

function ouvrirModifPlat(id) {
    const p = plats.find(x => x.id === id);
    if (!p) return;
    idEnEditionModale = id;
    document.getElementById('editPlatNom').value = p.plat;
    document.getElementById('editPlatParts').value = p.parts;
    document.getElementById('editPlatCat').value = p.categorie;
    document.getElementById('modalEdition').style.display = "block";
}

async function validerModifModale() {
    const pOrig = plats.find(x => x.id === idEnEditionModale);
    const data = {
        action: "update",
        rowId: idEnEditionModale,
        browserId: browserId,
        nom: pOrig.nom,
        convives: pOrig.convives,
        midi: pOrig.midi,
        soir: pOrig.soir,
        plat: document.getElementById('editPlatNom').value,
        parts: document.getElementById('editPlatParts').value,
        categorie: document.getElementById('editPlatCat').value,
        allergies: pOrig.allergies
    };
    fermerModale();
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
    await chargerDonnees();
}

// --- 5. LIVRE D'OR & ALLERGIES ---

async function ajouterCommentaireDirect() {
    const com = document.getElementById('commentaireSaisieSeule').value.trim();
    const nom = document.getElementById('nomPersonne').value.trim();
    if (!nom || !com) return alert("Prénom et message requis !");

    try {
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify({ action: "insertCommentaire", nom, commentaire: com, ownerId: browserId }) 
        });
        document.getElementById('commentaireSaisieSeule').value = "";
        await chargerDonnees();
    } catch (e) { alert("Erreur d'envoi"); }
}

function afficherLivreDor() {
    const container = document.getElementById('livreDor');
    if(!container) return;
    container.innerHTML = commentaires.map(m => `
        <div class="com-card" style="background:rgba(255,255,224,0.7); padding:15px; border-radius:10px; margin-bottom:10px; position:relative;">
            <p style="font-style:italic; margin-bottom:10px;">"${m.commentaire}"</p>
            <p style="text-align:right; font-weight:bold; margin:0;">— ${m.nom}</p>
            ${m.ownerId === browserId ? `<button onclick="ouvrirModifCom('${m.messageId}')" style="position:absolute; top:5px; right:5px; background:none; border:none; cursor:pointer;">✏️</button>` : ''}
        </div>`).reverse().join('');
}

function ouvrirModifCom(messageId) {
    const com = commentaires.find(c => c.messageId === messageId);
    if (!com) return;
    idEnEditionModale = messageId;
    document.getElementById('editCom').value = com.commentaire;
    document.getElementById('modalLivreDor').style.display = "block";
}

async function validerModifCom() {
    const txt = document.getElementById('editCom').value.trim();
    if (!txt) return;
    fermerModaleLivreDor();
    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "updateCommentaire", messageId: idEnEditionModale, browserId, commentaire: txt }) 
    });
    await chargerDonnees();
}

async function mettreAJourAllergies() {
    const allergie = document.getElementById('allergieSaisieSeule').value.trim();
    const nom = document.getElementById('nomPersonne').value.trim();
    if (!nom) return alert("Prénom requis !");

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "updateAllergies", browserId, allergies: allergie })
        });
        alert("Mis à jour !");
        await chargerDonnees();
    } catch (e) { alert("Erreur"); }
}

function afficherAllergies() {
    const conteneur = document.getElementById('allergieListe');
    const avecAllergies = listeParticipants.filter(p => p.allergies && p.allergies.trim() !== "");
    document.getElementById('total-allergies').innerText = avecAllergies.length;
    conteneur.innerHTML = avecAllergies.map(p => `<div class="plat-item" style="border-left: 4px solid #e74c3c;"><strong>${p.nom}</strong>: ${p.allergies}</div>`).join('') || '<p style="color:gray; padding:10px;">RAS</p>';
}

// --- 6. ADMIN & UTILS ---

function ouvrirAdmin() {
    const pass = prompt("Mot
