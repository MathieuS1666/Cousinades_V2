/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND
 * Liaison avec Google Sheets API (Plats & Livre d'Or)
 */

const API_URL = "https://script.google.com/macros/s/AKfycbwckxoG37eQcCOuLIcsKQv7KYdoktn_OAiBsuj0hpgWv-A4CvCEM7kmvPVIaunGGyGX/exec";
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

    container.innerHTML = commentaires.map(m => {
        // Sécurité : on récupère l'ID qu'il soit écrit 'messageId' ou 'MessageID'
        const idUnique = m.messageId || m.MessageID;
        
        // Le bouton n'apparaît que si l'ownerId correspond ET qu'il y a un ID de message
        const peutModifier = (m.ownerId === browserId && idUnique);

        return `
            <div class="com-card" style="position:relative;">
                ${peutModifier ? `
                    <div style="position:absolute; top:10px; right:10px; display:flex; gap:5px;">
                        <button onclick="ouvrirModifCom('${idUnique}', '${m.commentaire.replace(/'/g, "\\'")}')" title="Modifier">✏️</button>
                        <button onclick="supprimerCommentaire('${idUnique}')" title="Supprimer">🗑️</button>
                    </div>
                ` : ''}
                <p>"${m.commentaire}"</p>
                <p>— ${m.nom}</p>
            </div>
        `;
    }).reverse().join('');
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

/** function afficherPlats() {
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
                <span>${icon} <strong>${p.nom}</strong><br>${p.plat} (${p.parts}p)</span>
                ${p.ownerId === browserId ? `
                    <div style="display:flex; gap:5px;">
                        <button onclick="ouvrirModifPlat(${p.id})" title="Modifier" class="btn-action">✏️</button>
                        <button onclick="supprimerPlat(${p.id})" title="Supprimer" class="btn-action">🗑️</button>
                    </div>` : ''}
            </div>
        `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Rien pour le moment</div>';
    });
}
**/
function afficherPlats() { // avec allergies
    const cats = [
        ['aperoListe', 'apero', '🍹'],
        ['entreeListe', 'entree', '🥗'],
        ['platListe', 'platPrincipal', '🥘'],
        ['dessertListe', 'dessert', '🍰'],
        ['autreListe', 'autre', '📦']
    ];

    // 1. Affichage des catégories classiques
    cats.forEach(([elemId, key, icon]) => {
        const list = plats.filter(p => p.categorie === key && p.plat !== "Présence uniquement");
        const badge = document.getElementById('total-' + key);
        if (badge) badge.innerText = list.reduce((s, p) => s + parseInt(p.parts || 0), 0);

        document.getElementById(elemId).innerHTML = list.map(p => `
            <div class="plat-item">
                <span>${icon} <strong>${p.nom}</strong><br>${p.plat} (${p.parts}p)</span>
                ${p.ownerId === browserId ? `
                    <div style="display:flex; gap:5px;">
                        <button onclick="ouvrirModifPlat(${p.id})" title="Modifier" class="btn-action">✏️</button>
                        <button onclick="supprimerPlat(${p.id})" title="Supprimer" class="btn-action">🗑️</button>
                    </div>` : ''}
            </div>
        `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Rien pour le moment</div>';
    });

    // 2. Affichage spécifique de la colonne ALLERGIES (Unique par personne)
    const vus = new Set();
    const listeAllergies = plats.filter(p => {
        if (p.allergies && p.allergies.trim() !== "" && !vus.has(p.ownerId)) {
            vus.add(p.ownerId);
            return true;
        }
        return false;
    });

    const badgeAllergie = document.getElementById('total-allergies');
    if (badgeAllergie) badgeAllergie.innerText = listeAllergies.length;

    document.getElementById('allergieListe').innerHTML = listeAllergies.map(p => `
        <div class="plat-item" style="border-left-color: #e74c3c;">
            <span>🚫 <strong>${p.nom}</strong><br>${p.allergies}</span>
        </div>
    `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Aucune allergie</div>';
}
// --- 4. GESTION DU FORMULAIRE (AJOUT) ---
/**
async function ajouterPlat() {
    const radioCoche = document.querySelector('input[name="categoriePlat"]:checked');
    const catChoisie = radioCoche ? radioCoche.value : "autre";

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
        allergies: allergieVal,
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
**/

async function ajouterPlat() {
    const radioCoche = document.querySelector('input[name="categoriePlat"]:checked');
    const catChoisie = radioCoche ? radioCoche.value : "autre";

    const nomVal = document.getElementById('nomPersonne').value.trim();
    const convVal = document.getElementById('nbConvives').value;
    const platVal = document.getElementById('nouveauPlat').value.trim();
    const comVal = "";
    
    // --- LA CORRECTION EST ICI ---
    // On définit allergieVal en allant chercher le nouveau champ
    const champAllergie = document.getElementById('allergieSaisie');
    const allergieVal = champAllergie ? champAllergie.value.trim() : "";
    // ----------------------------

    const estDejaInscrit = document.getElementById('boxConvives').style.display === "none";

    if (!nomVal) return alert("Le prénom est requis !");
    if (!estDejaInscrit && !convVal) return alert("Le nombre de personnes est requis !");
    
   /** // On autorise la validation si au moins un des trois champs est rempli
    if (!platVal && !comVal && !allergieVal) {
        return alert("Saisissez un plat, un message ou une allergie !");
    } **/

    const fields = {
        nom: nomVal,
        convives: convVal || 0,
        plat: platVal || "Présence uniquement",
        parts: document.getElementById('nombreParts').value || 0,
        categorie: catChoisie,
        commentaire: comVal,
        allergies: allergieVal, // Maintenant allergieVal est bien défini !
        action: "insert",
        browserId: browserId
    };

    const btn = document.getElementById('btnAjouter');
    btn.disabled = true;
    btn.innerText = "Envoi...";

    try {
        await fetch(API_URL, { 
            method: 'POST', 
            body: JSON.stringify(fields) 
        });
        annulerEdition();
        await chargerDonnees();
    } catch (e) {
        console.error(e);
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
        browserId: browserId
    };
    fermerModale();
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
    await chargerDonnees();
}

// --- MODALE CONVIVES ---
/**
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
**/
function ouvrirModifConvives(id) {
    // 1. On trouve le plat
    const p = plats.find(x => x.id == id); // Utilise == pour plus de souplesse
    if (!p) return console.error("ID introuvable:", id);

    // 2. On mémorise quand même (sécurité)
    platEnEditionModale = p;

    // 3. MISE À JOUR DYNAMIQUE DU BOUTON
    // On force l'ID dans l'appel de la fonction de validation
    const btnEnregistrer = document.querySelector("#modalConvives button[onclick^='validerModifConvives']");
    if (btnEnregistrer) {
        btnEnregistrer.setAttribute("onclick", `validerModifConvives(${id})`);
    }

    document.getElementById('titreModalConvives').innerText = p.nom;
    document.getElementById('editNbConvives').value = p.convives;
    document.getElementById('modalConvives').style.display = "block";
}
// FERMER MODAL CONVIVIES

function fermerModaleConvives() {
    document.getElementById('modalConvives').style.display = "none";
    platEnEditionModale = null;
}
/**
async function validerModifConvives() {
    if (!platEnEditionModale) return;

    const saisi = document.getElementById('editNbConvives').value;
    const newNbConvives = parseFloat(saisi.replace(',', '.')) || 0; // Gère virgule/point

    // Validation simple
    if (isNaN(newNbConvives) || newNbConvives < 0) {
        alert("Veuillez saisir un nombre valide (ex: 1 ou 1.5)");
        return;
    }

    fermerModaleConvives(); // Effet visuel immédiat

    // Envoi au Sheet
    try {
    await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ 
            action: "update", 
            rowId: platEnEditionModale.id, 
            nom: platEnEditionModale.nom, 
            convives: newNbConvives,
            plat: platEnEditionModale.plat, 
            parts: platEnEditionModale.parts, 
            categorie: platEnEditionModale.categorie, 
            browserId: browserId 
        })
    });
setTimeout(async () => {
    await chargerDonnees(); // Rafraîchit tout
    }, 500);
} catch (e) {
        alert("Erreur lors de la sauvegarde...");
    }
}
**/

async function validerModifConvives(idForce) {
    // Si idForce n'est pas là, on essaie de récupérer la globale
    const id = idForce || (platEnEditionModale ? platEnEditionModale.id : null);
    
    if (!id) {
        alert("Erreur technique : ID du plat perdu.");
        return;
    }

    // On récupère l'objet plat correspondant à cet ID
    const p = plats.find(x => x.id == id);
    if (!p) return;

    const saisi = document.getElementById('editNbConvives').value;
    const newNbConvives = parseFloat(saisi.replace(',', '.')) || 0;

    fermerModaleConvives();

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "update", 
                rowId: id, // Utilisation de l'ID direct
                nom: p.nom, 
                convives: newNbConvives, 
                plat: p.plat, 
                parts: p.parts, 
                categorie: p.categorie, 
                browserId: browserId 
            })
        });
        await chargerDonnees();
    } catch (e) {
        console.error("Erreur lors de l'envoi :", e);
    }
}


// SUPPRIMER UN PLAT ----------------------------------------------
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
async function ajouterCommentaireDirect() {
    const nomVal = document.getElementById('nomPersonne').value.trim();
    const comVal = document.getElementById('commentaireSaisieSeule').value.trim();

    if (!nomVal || !comVal) {
        alert("Merci de saisir votre nom et un message !");
        return;
    }

    const btn = document.getElementById('btnCom');
    btn.disabled = true;
    btn.innerText = "Publication...";

    const fields = {
        nom: nomVal,
        commentaire: comVal,
        action: "insert",
        browserId: browserId,
        plat: "Message Livre d'Or" // Indispensable pour que le GAS sache que c'est un message
    };

    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(fields) });
        document.getElementById('commentaireSaisieSeule').value = "";
        await chargerDonnees();
    } catch (e) {
        alert("Erreur de publication");
    } finally {
        btn.disabled = false;
        btn.innerText = "Publier mon message";
    }
}
// --- LANCEMENT ---
mettreAJourCompteARebours();
chargerDonnees();
