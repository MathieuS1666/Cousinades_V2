/**
 * COUSINADE BOB 2026 - LOGIQUE FRONTEND
 */
// adresse du script Google
const API_URL = "https://script.google.com/macros/s/AKfycbw1a8S54T7A5w8hYV4xsF5W_cDDJuUkNvPdcOVZPEPDZyqUwb-kmwZcX9paNvriFLs/exec";
// date de la cousinade pour le compte à rebours
const DATE_COUSINADE = new Date("2026-05-09T12:00:00");

let plats = [];
let commentaires = []; 
let idEnEditionModale = null;
let platEnEditionModale = null; 
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

// --- 2. STATISTIQUES ET AFFICHAGE ---
// statistiques
function calculerStatsGlobales() {
    let totalMidi = 0;
    let totalSoir = 0;
    let totalConv = 0;
    const vus = new Set();
    
    plats.forEach(p => {
        if (!vus.has(p.ownerId)) {
            const nb = parseFloat(p.convives || 0);
            // Vérification souple (booléen ou string "true")
            if (p.midi === true || p.midi === "true") totalMidi += nb;
            if (p.soir === true || p.soir === "true") totalSoir += nb;
            totalConv += nb;
            vus.add(p.ownerId);
        }
    });

    if(document.getElementById('stat-convives')) document.getElementById('stat-convives').innerText = totalConv;
    if(document.getElementById('stat-midi')) document.getElementById('stat-midi').innerText = totalMidi;
    if(document.getElementById('stat-soir')) document.getElementById('stat-soir').innerText = totalSoir;
    if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = plats.reduce((s, p) => s + parseInt(p.parts || 0), 0);
    
    // Affichage Liste des Présents
    const unique = {};
    plats.forEach(p => { if (!unique[p.nom]) unique[p.nom] = p; });
    
    document.getElementById('listePresents').innerHTML = Object.values(unique).map(p => {
        let labels = [];
        if (p.midi === true || p.midi === "TRUE") labels.push("☀️M");
        if (p.soir === true || p.soir === "TRUE") labels.push("🌙S");
        
        return `
            <span class="badge-present">
                <strong>${p.nom}</strong> : ${p.convives}<br>
                <small>${labels.join(' / ')}</small>
                ${p.ownerId === browserId ? `<button onclick="ouvrirModifConvives(${p.id})" class="btn-edit-small">✏️</button>` : ''}
            </span>
        `;
    }).join('');

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

    // Allergies
    const vusAll = new Set();
    const listeAllergies = plats.filter(p => {
        if (p.allergies && p.allergies.trim() !== "" && !vusAll.has(p.ownerId)) {
            vusAll.add(p.ownerId); return true;
        }
        return false;
    });
    document.getElementById('allergieListe').innerHTML = listeAllergies.map(p => `
        <div class="plat-item" style="border-left-color: #e74c3c;">
            <span>🚫 <strong>${p.nom}</strong><br>${p.allergies}</span>
        </div>
    `).join('') || '<div style="color:gray; font-size:0.8em; padding:5px;">Aucune allergie</div>';
}

// --- 3. ACTIONS FORMULAIRE ---

async function ajouterPlat() {
    const nomVal = document.getElementById('nomPersonne').value.trim();
    const convVal = document.getElementById('nbConvives').value;
    const platVal = document.getElementById('nouveauPlat').value.trim();
    const radioCoche = document.querySelector('input[name="categoriePlat"]:checked');
    const catChoisie = radioCoche ? radioCoche.value : "autre";
    
    // Sécurité : on vérifie si les éléments existent avant de lire .checked
    const midiVal = document.getElementById('checkMidi') ? document.getElementById('checkMidi').checked : false;
    const soirVal = document.getElementById('checkSoir') ? document.getElementById('checkSoir').checked : false;
    const allergieVal = document.getElementById('allergieSaisie') ? document.getElementById('allergieSaisie').value.trim() : "";

    const estDejaInscrit = document.getElementById('boxConvives').style.display === "none";

    if (!nomVal) return alert("Le prénom est requis !");
    if (!estDejaInscrit && !convVal) return alert("Le nombre de personnes est requis !");
    if (estDejaInscrit && !platVal && !allergieVal) return alert("Saisissez un plat ou une allergie !");

    const btn = document.getElementById('btnAjouter');
    btn.disabled = true;
    btn.innerText = "Envoi...";

    const fields = {
        nom: nomVal,
        convives: convVal || 0,
        midi: midiVal,
        soir: soirVal,
        plat: platVal || "Présence uniquement",
        parts: document.getElementById('nombreParts').value || 0,
        categorie: catChoisie,
        allergies: allergieVal,
        action: "insert",
        browserId: browserId
    };

    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify(fields) });
        annulerEdition();
        await chargerDonnees();
    } catch (e) {
        alert("Erreur de connexion");
    } finally {
        btn.disabled = false;
        btn.innerText = "Valider";
    }
}

// --- 4. MODALES MODIFICATIONS ---

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
    const p = plats.find(x => x.id === idEnEditionModale);
    const data = {
        action: "update",
        rowId: idEnEditionModale,
        nom: p.nom,
        convives: p.convives,
        midi: p.midi,
        soir: p.soir,
        plat: document.getElementById('editPlatNom').value.trim(),
        parts: document.getElementById('editPlatParts').value,
        categorie: document.getElementById('editPlatCat').value,
        allergies: p.allergies,
        browserId: browserId
    };
    document.getElementById('modalEdition').style.display = "none";
    await fetch(API_URL, { method: 'POST', body: JSON.stringify(data) });
    await chargerDonnees();
}

function ouvrirModifConvives(id) {
    const p = plats.find(x => x.id == id);
    if (!p) return;
    platEnEditionModale = p;
    document.getElementById('titreModalConvives').innerText = p.nom;
    document.getElementById('editNbConvives').value = p.convives;
    
    // Cocher les cases de la modale selon les data
    if(document.getElementById('editCheckMidi')) document.getElementById('editCheckMidi').checked = (p.midi === true || p.midi === "true");
    if(document.getElementById('editCheckSoir')) document.getElementById('editCheckSoir').checked = (p.soir === true || p.soir === "true");
    
    document.getElementById('modalConvives').style.display = "block";
}

/**async function validerModifConvives() {
    if (!platEnEditionModale) return;
    const p = platEnEditionModale;
    const newNb = parseFloat(document.getElementById('editNbConvives').value.replace(',', '.')) || 0;
    const isMidi = document.getElementById('editCheckMidi').checked;
    const isSoir = document.getElementById('editCheckSoir').checked;

    document.getElementById('modalConvives').style.display = "none";

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ 
                action: "update", 
                rowId: p.id,
                nom: p.nom, 
                convives: newNb,
                midi: isMidi,
                soir: isSoir,
                plat: p.plat, 
                parts: p.parts, 
                categorie: p.categorie,
                allergies: p.allergies,
                browserId: browserId 
            })
        });
        await chargerDonnees();
    } catch (e) { console.error(e); }
}
**/
async function validerModifConvives() {
    if (!platEnEditionModale) return;
    
    const newNb = parseFloat(document.getElementById('editNbConvives').value.replace(',', '.')) || 0;
    const isMidi = document.getElementById('editCheckMidi').checked;
    const isSoir = document.getElementById('editCheckSoir').checked;

    document.getElementById('modalConvives').style.display = "none";

    // ON PRÉPARE LES DONNÉES
    const data = { 
        action: "update", 
        rowId: platEnEditionModale.id,
        nom: platEnEditionModale.nom, 
        convives: newNb,
        midi: isMidi,
        soir: isSoir,
        plat: platEnEditionModale.plat, 
        parts: platEnEditionModale.parts, 
        categorie: platEnEditionModale.categorie,
        allergies: platEnEditionModale.allergies,
        browserId: browserId // Très important pour le script Google
    };

    try {
        await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        // PETITE ASTUCE : On met à jour localement les données immédiatement 
        // pour que le calcul des stats soit instantané après le fetch
        plats.forEach(p => {
            if (p.ownerId === browserId) {
                p.convives = newNb;
                p.midi = isMidi;
                p.soir = isSoir;
            }
        });

        await chargerDonnees();
    } catch (e) { console.error(e); }
}

// --- LIVRE D'OR ---

function afficherLivreDor() {
    const container = document.getElementById('livreDor');
    if (!container) return;
    container.innerHTML = commentaires.map(m => {
        const idUnique = m.messageId || m.MessageID;
        const peutModifier = (m.ownerId === browserId && idUnique);
        return `
            <div class="com-card">
                ${peutModifier ? `<button onclick="ouvrirModifCom('${idUnique}', '${m.commentaire.replace(/'/g, "\\'")}')">✏️</button>` : ''}
                <p>"${m.commentaire}"</p><p>— ${m.nom}</p>
            </div>`;
    }).reverse().join('');
}

// --- RESTE DES FONCTIONS (Statiques) ---
function fermerModale() { document.getElementById('modalEdition').style.display = "none"; }

function fermerModaleConvives() { document.getElementById('modalConvives').style.display = "none"; }

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
    chargerDonnees();
}
function mettreAJourCompteARebours() {
    const diff = DATE_COUSINADE - new Date();
    const jours = Math.floor(diff / (1000 * 60 * 60 * 24));
    document.getElementById("countdown").innerText = diff > 0 ? `J-${jours} avant la cousinade !` : "C'est le jour J ! 🎉";
}

function ouvrirAdmin() {
    const code = prompt("Entrez le code administrateur :");
    if (code === "1234") { // Change "1234" par ton code
        const urlSheet = "https://docs.google.com/spreadsheets/d/1F-Bx57myPupGgfFNAN79Pn8pQNON3aWg1pmF0jLFVNI/edit?usp=sharing";
        window.open(urlSheet, '_blank');
    } else {
        alert("Code incorrect");
    }
}

mettreAJourCompteARebours();
chargerDonnees();
