/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND
 * Liaison avec Google Sheets API (Plats & Livre d'Or)
 */

const API_URL = "https://script.google.com/macros/s/AKfycbyLaPl6KsvFC-t4aPrSES-W7r06KP1PrbVCudxNqVj0sGUhieUyh_9muh-IxONWuDJ_/exec";
const DATE_COUSINADE = new Date("2026-05-09T12:00:00");

let plats = [];
let commentaires = []; 
let idEnEditionModale = null;
let modeEdition = false;
let idEnCoursEdition = null;
// Variables pour suivre ce qu'on est en train de modifier
let platEnEditionModale = null; // Contiendra l'objet plat complet
let comNomEnEdition = null;    // Pour le livre d'or
let comMessageOrigine = null;  // Pour le livre d'or
// Identification du navigateur
let browserId = localStorage.getItem('cousinade_id') || ('user_' + Math.random().toString(36).substr(2, 9));
localStorage.setItem('cousinade_id', browserId);

// --- 1. CHARGEMENT DES DONNÉES ---

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

function chargerPlats() { chargerDonnees(); }

// --- 2. AFFICHAGE DU LIVRE D'OR ---

function afficherLivreDor() {
    const container = document.getElementById('livreDor');
    if (!container) return;

    container.innerHTML = commentaires.map(m => `
        <div class="com-card" style="background:#fff9e6; padding:15px; border-radius:10px; border-left:5px solid #feca57; position:relative; box-shadow: 2px 2px 5px rgba(0,0,0,0.05); margin-bottom:10px;">
            
            ${m.ownerId === browserId ? `
                <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px;">
                    <button onclick="ouvrirModifCom('${m.nom}', '${m.commentaire.replace(/'/g, "\\'")}')" title="Modifier" style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:0;">✏️</button>
                    <button onclick="supprimerCommentaire('${m.nom}')" title="Supprimer" style="background:none;border:none;cursor:pointer;font-size:1.1em;padding:0;">🗑️</button>
                </div>
            ` : ''}

            <p style="margin:0; font-style:italic; white-space:pre-wrap; color:#444; padding-right:40px;">"${m.commentaire}"</p>
            <p style="margin:10px 0 0 0; text-align:right; font-weight:bold; font-size:0.8em; color:#2c3e50;">— ${m.nom}</p>
        </div>
    `).reverse().join('') || '<p style="text-align:center;color:gray;">Aucun message pour le moment...</p>';
}

// --- 3. STATISTIQUES ET AFFICHAGE DES PLATS ---

function calculerStatsGlobales() {
    const vus = new Set();
    let totalConv = 0;
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
        'autre': 'stat-autre'
    };

    Object.keys(statsMapping).forEach(key => {
        const total = plats.filter(p => p.categorie === key).reduce((s, p) => s + parseInt(p.parts || 0), 0);
        const element = document.getElementById(statsMapping[key]);
        if (element) element.innerText = total;
    });

    const unique = {};
    plats.forEach(p => { if (!unique[p.nom]) unique[p.nom] = p; });
    document.getElementById('listePresents').innerHTML = Object.values(unique).map(p => `
        <span class="badge-present"><strong>${p.nom}</strong> : ${p.convives}
        ${p.ownerId === browserId ? `<button onclick="ouvrirModifConvives(${p.id})" class="btn-edit-small">✏️</button>` : ''}</span>
    `).join('');

    verifierSiDejaInscrit();
}

function afficherPlats() {
    const cats = [
        ['aperoListe', 'apero', '🍹'],
        ['entreeListe', 'entree', '🥗'],
        ['platListe', 'platPrincipal', '🥘'],
        ['dessertListe', 'dessert', '🍰'],
        ['autreListe', 'autre', '📦']
    ];

    cats.forEach(([elemId, key, icon]) => {
        const list = plats.filter(p => p.categorie === key && p.plat !== "Présence uniquement");
        const badge = document.getElementById('total-' + key);
        if (badge) badge.innerText = list.reduce((s, p) => s + parseInt(p.parts || 0), 0);

        document.getElementById(elemId).innerHTML = list.map(p => `
            <div class="plat-item">
                <span>
                    ${icon} <strong>${p.nom}</strong>
                    ${p.allergies ? `<span title="Attention : ${p.allergies}" style="cursor:help; background:#ff4757; color:white; padding:1px 5px; border-radius:50%; font-size:0.7em; margin-left:5px;">!</span>` : ''}
                    <br>${p.plat} (${p.parts}p)
                </span>
                ${p.ownerId === browserId ? `
                    <div style="display:flex; gap:5px;">
                        <button onclick="ouvrirModifPlat(${p.id})" title="Modifier" class="btn-action">✏️</button>
                        <button onclick="supprimerPlat(${p.id})" title="Supprimer" class="btn-action">🗑️</button>
                    </div>` : ''}
            </div>
        `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Rien pour le moment</div>';
    });
}

// --- 4. GESTION DU FORMULAIRE (AJOUT) ---

async function ajouterPlat() {
    const radioCoche = document.querySelector('input[name="categoriePlat"]:checked');
    const catChoisie = radioCoche ? radioCoche.value : "autre";
    const allergiesVal = document.getElementById('allergies').value.trim(); // <--- ICI
    const nomVal = document.getElementById('nomPersonne').value.trim();
    const convVal = document.getElementById('nbConvives').value;
    const platVal = document.getElementById('nouveauPlat').value.trim();
    const comVal = document.getElementById('commentaire').value.trim();

    const estDejaInscrit = document.getElementById('boxConvives').style.display === "none";
    
    if (!nomVal) return alert("Le prénom est requis !");
    if (!estDejaInscrit && !convVal) return alert("Le nombre de personnes est requis !");
    if (!platVal && !comVal) return alert("Saisissez un plat ou un message !");

    const fields = {
        nom: nomVal,
        convives: convVal || 0,
        plat: platVal || "Présence uniquement",
        parts: document.getElementById('nombreParts').value || 0,
        categorie: catChoisie,
        commentaire: comVal,
        allergies: allergiesVal,
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
        alert("Erreur réseau, réessaye !");
    } finally {
        btn.disabled = false;
        btn.innerText = "Valider";
    }
}

function annulerEdition() {
    modeEdition = false; 
    idEnCoursEdition = null;
    document.querySelectorAll('input[type="text"], input[type="number"], textarea').forEach(i => i.value = '');
    document.querySelectorAll('input[name="categoriePlat"]').forEach(r => r.checked = false);
    document.getElementById('btnAnnuler').style.display = "none";
    verifierSiDejaInscrit();
}

// --- 5. MODALE & MODIFS ---

function ouvrirModifPlat(id) {
    const p = plats.find(x => x.id === id);
    if (!p) return;
    idEnEditionModale = id;
    document.getElementById('editPlatNom').value = p.plat;
    document.getElementById('editPlatParts').value = p.parts;
    document.getElementById('editPlatCat').value = p.categorie;
    document.getElementById('editPlatAllergies').value = p.allergies || "";
    document.getElementById('modalEdition').style.display = "block";
}

function fermerModale() {
    document.getElementById('modalEdition').style.display = "none";
}

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
        allergies: document.getElementById('editPlatAllergies').value.trim(),
        browserId: browserId
    };
    fermerModale();
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
    await chargerDonnees();
}

// --- MODALE CONVIVES ---

function ouvrirModifConvives(id) {
    const p = plats.find(x => x.id === id);
    if (!p) return;

    platEnEditionModale = p; // On stocke le plat
    
    // On remplit la modale
    document.getElementById('titreModalConvives').innerText = p.nom;
    document.getElementById('editNbConvives').value = p.convives;

    // On affiche
    document.getElementById('modalConvives').style.display = "block";
}

function fermerModaleConvives() {
    document.getElementById('modalConvives').style.display = "none";
    platEnEditionModale = null;
}

async function validerModifConvives() {
    if (!platEnEditionModale) return;
    
    const saisi = document.getElementById('editNbConvives').value;
    const newNbConvives = parseFloat(saisi.replace(',', '.')); // Gère virgule/point

    // Validation simple
    if (isNaN(newNbConvives) || newNbConvives < 0) {
        alert("Veuillez saisir un nombre valide (ex: 1 ou 1.5)");
        return;
    }

    fermerModaleConvives(); // Effet visuel immédiat

    // Envoi au Sheet
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: "update", 
            rowId: platEnEditionModale.id, 
            nom: platEnEditionModale.nom, 
            convives: newNbConvives, // La nouvelle valeur
            // On garde les infos du plat inchangées
            plat: platEnEditionModale.plat, 
            parts: platEnEditionModale.parts, 
            categorie: platEnEditionModale.categorie, 
            browserId: browserId 
        })
    });

    await chargerDonnees(); // Rafraîchit tout
}

async function supprimerPlat(id) {
    if (!confirm("Supprimer ce plat ?")) return;
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: "delete", rowId: id, browserId: browserId }) });
    await chargerDonnees();
}

// --- 6. GESTION DU LIVRE D'OR (MODIFS/SUPPR) ---

// --- MODALE LIVRE D'OR ---

function ouvrirModifCom(nom, ancienMessage) {
    comNomEnEdition = nom;
    comMessageOrigine = ancienMessage;

    // On remplit le textarea
    document.getElementById('editCom').value = ancienMessage;

    // On affiche
    document.getElementById('modalLivreDor').style.display = "block";
}

function fermerModaleLivreDor() {
    document.getElementById('modalLivreDor').style.display = "none";
    comNomEnEdition = null;
    comMessageOrigine = null;
}

async function validerModifCom() {
    const nouveauMessage = document.getElementById('editCom').value.trim();
    
    // Si pas de changement, on ferme juste
    if (nouveauMessage === comMessageOrigine) {
        fermerModaleLivreDor();
        return;
    }

    // Si le message est vide, on considère que c'est une suppression
    if (nouveauMessage === "") {
        supprimerCommentaire(comNomEnEdition); // Appelle la fonction existante
        fermerModaleLivreDor();
        return;
    }

    fermerModaleLivreDor(); // Effet visuel immédiat

    // Envoi au Sheet
    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ 
            action: "updateCommentaire", 
            nom: comNomEnEdition, 
            commentaire: nouveauMessage, // Le nouveau message
            browserId: browserId 
        })
    });
    
    await chargerDonnees();
}

async function supprimerCommentaire(nom) {
    if (!confirm("Voulez-vous supprimer ce message du livre d'or ?")) return;

    await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ 
            action: "updateCommentaire", 
            nom: nom, 
            commentaire: "", // Envoi vide pour masquer/supprimer
            browserId: browserId 
        })
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
        inputNom.style.background = "#f0f0f0";
    } else {
        box.style.display = "block";
        msgOk.style.display = "none";
        inputNom.readOnly = false;
        inputNom.style.background = "white";
    }
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

// --- LANCEMENT ---
mettreAJourCompteARebours();
chargerDonnees();
