/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND COMPLET
 */

const API_URL = "https://script.google.com/macros/s/AKfycbyqSdFmEemSsfNuZSu38vz8WQJvZgTJXChEVY6WWIi8aD_pWYYDbVYb6JbHM-UFAQ8s/exec";
const DATE_COUSINADE = new Date("2026-05-09T12:00:00");

let plats = [];
let commentaires = []; 
let idEnEditionModale = null;
let platEnEditionModale = null; 
let comNomEnEdition = null;    
let comMessageOrigine = null;  

// Identification unique du navigateur
let browserId = localStorage.getItem('cousinade_id') || ('user_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('cousinade_id', browserId);

// --- 1. CHARGEMENT ---

async function chargerDonnees() {
    try {
        const [resPlats, resComs] = await Promise.all([
            fetch(`${API_URL}?action=getPlats`),
            fetch(`${API_URL}?action=getCommentaires`)
        ]);

        plats = await resPlats.json();
        commentaires = await resComs.json();

        afficherPlats();
        afficherLivreDor(); 
        calculerStatsGlobales();
    } catch (e) {
        console.error("Erreur de chargement :", e);
    }
}

// --- 2. AFFICHAGE DES LISTES (AVEC CATÉGORIE ALLERGIE) ---

function afficherPlats() {
    const cats = [
        ['allergieListe', 'allergie', '⚠️'],
        ['aperoListe', 'apero', '🍹'],
        ['entreeListe', 'entree', '🥗'],
        ['platListe', 'platPrincipal', '🥘'],
        ['dessertListe', 'dessert', '🍰'],
        ['autreListe', 'autre', '📦']
    ];

    cats.forEach(([elemId, key, icon]) => {
        const container = document.getElementById(elemId);
        if (!container) return;

        const list = plats.filter(p => p.categorie === key && p.plat !== "Présence uniquement");
        
        // Mise à jour du petit compteur dans le titre de la section
        const badge = document.getElementById('total-' + key);
        if (badge) {
            const totalParts = list.reduce((s, p) => s + parseInt(p.parts || 0), 0);
            badge.innerText = totalParts || list.length; // Affiche nb parts ou nb éléments
        }

        container.innerHTML = list.map(p => `
            <div class="plat-item" style="${key === 'allergie' ? 'border-left: 5px solid #e74c3c; background: #fff5f5;' : ''}">
                <span>${icon} <strong>${p.nom}</strong><br>${p.plat} ${p.parts > 0 ? `(${p.parts}p)` : ''}</span>
                ${p.ownerId === browserId ? `
                    <div style="display:flex; gap:5px;">
                        <button onclick="ouvrirModifPlat(${p.id})" title="Modifier" class="btn-action">✏️</button>
                        <button onclick="supprimerPlat(${p.id})" title="Supprimer" class="btn-action">🗑️</button>
                    </div>` : ''}
            </div>
        `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Rien pour le moment</div>';
    });
}

// --- 3. STATISTIQUES ---

function calculerStatsGlobales() {
    const vus = new Set();
    let totalConv = 0;
    
    // Calcul des convives uniques par OwnerID
    plats.forEach(p => {
        if (!vus.has(p.ownerId)) {
            totalConv += parseFloat(p.convives || 0);
            vus.add(p.ownerId);
        }
    });

    document.getElementById('stat-convives').innerText = totalConv;
    document.getElementById('stat-total').innerText = plats.reduce((s, p) => s + parseInt(p.parts || 0), 0);

    const statsMapping = {
        'apero': 'stat-apero',
        'entree': 'stat-entrees',
        'platPrincipal': 'stat-plats',
        'dessert': 'stat-desserts',
        'allergie': 'stat-allergies',
        'autre': 'stat-autre'
    };

    Object.keys(statsMapping).forEach(key => {
        const total = plats.filter(p => p.categorie === key).reduce((s, p) => s + parseInt(p.parts || 0), 0);
        const element = document.getElementById(statsMapping[key]);
        if (element) element.innerText = total || plats.filter(p => p.categorie === key).length;
    });

    // Liste des présents (Badges)
    const unique = {};
    plats.forEach(p => { if (!unique[p.ownerId]) unique[p.ownerId] = p; });
    
    document.getElementById('listePresents').innerHTML = Object.values(unique).map(p => `
        <span class="badge-present">
            <strong>${p.nom}</strong> : ${p.convives}
            ${p.ownerId === browserId ? `<button onclick="ouvrirModifConvives(${p.id})" class="btn-edit-small">✏️</button>` : ''}
        </span>
    `).join('');

    verifierSiDejaInscrit();
}

// --- 4. ACTIONS FORMULAIRE (INSERT) ---

async function ajouterPlat() {
    const radioCoche = document.querySelector('input[name="categoriePlat"]:checked');
    const catChoisie = radioCoche ? radioCoche.value : "autre";
    
    const nomVal = document.getElementById('nomPersonne').value.trim();
    const convVal = document.getElementById('nbConvives').value;
    const platVal = document.getElementById('nouveauPlat').value.trim();
    const partsVal = document.getElementById('nombreParts').value || 0;
    const comVal = document.getElementById('commentaire').value.trim();

    const estDejaInscrit = document.getElementById('boxConvives').style.display === "none";
    
    if (!nomVal) return alert("Le prénom est requis !");
    if (!estDejaInscrit && !convVal) return alert("Le nombre de personnes est requis !");
    if (!platVal && !comVal) return alert("Saisissez un apport (ou une allergie) ou un message !");

    const fields = {
        nom: nomVal,
        convives: convVal || 0,
        plat: platVal || "Présence uniquement",
        parts: partsVal,
        categorie: catChoisie,
        commentaire: comVal,
        action: "insert",
        browserId: browserId
    };

    const btn = document.getElementById('btnAjouter');
    btn.disabled = true;
    btn.innerText = "Envoi...";

    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(fields) });
        annulerEdition();
        await chargerDonnees();
    } catch (e) {
        alert("Erreur réseau !");
    } finally {
        btn.disabled = false;
        btn.innerText = "Valider";
    }
}

// --- 5. MODALES (EDITION / SUPPRESSION) ---

// --- EDIT PLAT ---
function ouvrirModifPlat(id) {
    const p = plats.find(x => x.id === id);
    if (!p) return;
    idEnEditionModale = id;
    document.getElementById('editPlatNom').value = p.plat;
    document.getElementById('editPlatParts').value = p.parts;
    document.getElementById('editPlatCat').value = p.categorie;
    document.getElementById('modalEdition').style.display = "block";
}

function fermerModale() { document.getElementById('modalEdition').style.display = "none"; }

async function validerModifModale() {
    const p = plats.find(x => x.id === idEnEditionModale);
    const data = {
        action: "update",
        rowId: idEnEditionModale,
        nom: p.nom,
        convives: p.convives,
        plat: document.getElementById('editPlatNom').value.trim(),
        parts: document.getElementById('editPlatParts').value,
        categorie: document.getElementById('editPlatCat').value,
        browserId: browserId
    };
    fermerModale();
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
    await chargerDonnees();
}

// --- EDIT CONVIVES ---
function ouvrirModifConvives(id) {
    const p = plats.find(x => x.id === id);
    if (!p) return;
    platEnEditionModale = p;
    document.getElementById('titreModalConvives').innerText = p.nom;
    document.getElementById('editNbConvives').value = p.convives;
    document.getElementById('modalConvives').style.display = "block";
}

function fermerModaleConvives() { document.getElementById('modalConvives').style.display = "none"; }

async function validerModifConvives() {
    const newNb = document.getElementById('editNbConvives').value;
    fermerModaleConvives();
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: "update", 
            rowId: platEnEditionModale.id, 
            nom: platEnEditionModale.nom, 
            convives: newNb,
            plat: platEnEditionModale.plat,
            parts: platEnEditionModale.parts,
            categorie: platEnEditionModale.categorie,
            browserId: browserId 
        })
    });
    await chargerDonnees();
}

// --- SUPPRESSION PLAT ---
async function supprimerPlat(id) {
    if (!confirm("Supprimer cet élément ?")) return;
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "delete", rowId: id, browserId: browserId }) });
    await chargerDonnees();
}

// --- 6. LIVRE D'OR ---

function afficherLivreDor() {
    const container = document.getElementById('livreDor');
    if (!container) return;
    container.innerHTML = commentaires.map(m => `
        <div class="com-card" style="background:#fff9e6; padding:15px; border-radius:10px; position:relative; margin-bottom:10px;">
            ${m.ownerId === browserId ? `
                <div style="position:absolute; top:10px; right:10px;">
                    <button onclick="ouvrirModifCom('${m.nom}', '${m.commentaire.replace(/'/g, "\\'")}')" class="btn-action">✏️</button>
                    <button onclick="supprimerCommentaire('${m.nom}')" class="btn-action">🗑️</button>
                </div>` : ''}
            <p>"${m.commentaire}"</p>
            <p style="text-align:right; font-weight:bold;">— ${m.nom}</p>
        </div>
    `).reverse().join('') || '<p>Aucun message...</p>';
}

function ouvrirModifCom(nom, msg) {
    comNomEnEdition = nom;
    comMessageOrigine = msg;
    document.getElementById('editCom').value = msg;
    document.getElementById('modalLivreDor').style.display = "block";
}

function fermerModaleLivreDor() { document.getElementById('modalLivreDor').style.display = "none"; }

async function validerModifCom() {
    const nouveauMessage = document.getElementById('editCom').value.trim();
    fermerModaleLivreDor();
    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "updateCommentaire", nom: comNomEnEdition, commentaire: nouveauMessage, browserId: browserId }) 
    });
    await chargerDonnees();
}

async function supprimerCommentaire(nom) {
    if (!confirm("Supprimer votre message ?")) return;
    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: "updateCommentaire", nom: nom, commentaire: "", browserId: browserId }) 
    });
    await chargerDonnees();
}

// --- 7. UTILITAIRES ---

function verifierSiDejaInscrit() {
    const monInscription = plats.find(p => p.ownerId === browserId);
    const box = document.getElementById('boxConvives');
    const msgOk = document.getElementById('msgConvivesOk');
    const inputNom = document.getElementById('nomPersonne');

    if (monInscription) {
        box.style.display = "none";
        msgOk.style.display = "block";
        inputNom.value = monInscription.nom;
        inputNom.readOnly = true;
    } else {
        box.style.display = "block";
        msgOk.style.display = "none";
        inputNom.readOnly = false;
    }
}

function annulerEdition() {
    document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(i => i.value = '');
    document.querySelectorAll('input[name="categoriePlat"]').forEach(r => r.checked = false);
    verifierSiDejaInscrit();
}

function mettreAJourCompteARebours() {
    const diff = DATE_COUSINADE - new Date();
    if (diff <= 0) {
        document.getElementById("countdown").innerText = "C'est le jour J ! 🎉";
        return;
    }
    const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
    document.getElementById("countdown").innerText = `J-${jours} avant la cousinade !`;
}

function ouvrirAdmin() {
    if (prompt("Pass :") === "1234") {
        window.open("https://docs.google.com/spreadsheets/d/1ouuhTU8QERvZwBimUb-VrpOR4lpkjv8WGlsBqKuFZa8/edit?usp=sharing");
    }
}

// LANCEMENT
mettreAJourCompteARebours();
chargerDonnees();
