import {
    Identifiant,
    creerNoeud, Noeud
} from "../../bibliotheque/communication";
import {
    elementParId, recupererEntree, initialiserEntree, contenuBalise, poster, posterNL,
    gererEvenementDocument, gererEvenementElement,
    elementSaisieEnvoi
} from "../../bibliotheque/vueClient";
import { CanalClient } from "../../bibliotheque/client";
import {
    hote, port2,
    creerMessageCommunication,
    TypeMessageTchat, FormatMessageTchat, MessageTchat,
    FormatConfigurationTchat, ConfigurationTchat,
    FormatErreurTchat,
    FormatSommetTchat, creerSommetTchat,
    creerNoeudDeConfiguration
} from '../commun/tchat';

console.log("* Chargement du script");

/* Test - déclaration d'une variable externe - Possible
cf. declare
*/

const adresseServeur: string = hote + ":" + port2;

type CanalTchat = CanalClient<FormatErreurTchat, FormatConfigurationTchat, FormatMessageTchat>;

// A initialiser
var canal: CanalTchat;
var noeud: Noeud<FormatSommetTchat>;


function envoyerMessage(texte: string, destinataire: Identifiant) {
    let msg: MessageTchat = creerMessageCommunication(noeud.centre().enJSON().id, destinataire, texte);
    console.log("- Envoi du message brut : " + msg.brut());
    console.log("- Envoi du message net : " + msg.net());
    canal.envoyerMessage(msg);
}

// A exécuter après chargement de la page
// - pas d'interruption de la fonction
function initialisation(): void {
    console.log("* Initialisation après chargement du DOM");

    console.log("- du canal de communication avec le serveur d'adresse " + adresseServeur);
    canal = new CanalClient<FormatErreurTchat, FormatConfigurationTchat, FormatMessageTchat>(adresseServeur);

    console.log("- du traitement des messages");
    canal.enregistrerTraitementMessageRecu((m: FormatMessageTchat) => {
        let msg = new MessageTchat(m);
        console.log("* Réception");
        console.log("- du message brut : " + msg.brut());
        console.log("- du message net : " + msg.net());
        posterNL('logChats', msg.net());
    });

    console.log("- du traitement de la configuration");
    console.log("- du noeud du réseau");
    canal.enregistrerTraitementConfigurationRecue((c: FormatConfigurationTchat) => {
        let config = new ConfigurationTchat(c);
        console.log("* Réception");
        console.log("- de la configuration brute : " + config.brut());
        console.log("- de la configuration nette : " + config.net());
        noeud = creerNoeudDeConfiguration(config);
        voir();
    });




}

function voir(): void {
    console.log("* Consolidation de la vue");
    console.log("- adresse, centre, voisins");
    poster("adresseServeur", adresseServeur);
    poster("centre", noeud.centre().net());
    poster("voisins", JSON.stringify(noeud.voisinsEnJSON()));

    console.log("- formulaire");
    let voisinsNoeud = noeud.voisinsEnJSON();
    let repVoisinsNoeud: string = JSON.stringify(voisinsNoeud);
    let contenuFormulaire = "";
    for (let idV in voisinsNoeud) {
        poster("formulaire", elementSaisieEnvoi("message_" + idV, "boutonEnvoi_" + idV,
            "Envoyer un message à " + noeud.voisin(idV).enJSON().pseudo + "."));
    }
    let type = "click";
    for (const idV in voisinsNoeud) {
        console.log("- Element " + idV + " : enregistrement d'un gestionnaire pour l'événement " + type);
        gererEvenementElement("boutonEnvoi_" + idV, type, e => {
            let entree = recupererEntree("message_" + idV);
            initialiserEntree("message_" + idV, "");
            console.log("* Entree : " + entree);
            envoyerMessage(entree, idV);
        });
    }
    /*
      <input type="text" id="message_id1"> 
      <input class="button" type="button" id="boutonEnvoi_id1" value="Envoyer un message à {{nom id1}}."
         onClick="envoyerMessage(this.form.message.value, "id1")">
    */

}

// Gestion des événements pour le document
console.log("* Enregistrement de l'initialisation au chargement");
gererEvenementDocument('DOMContentLoaded', initialisation);
/*
<script type="text/javascript">
  document.addEventListener('DOMContentLoaded', initialisation());
</script>

*/

