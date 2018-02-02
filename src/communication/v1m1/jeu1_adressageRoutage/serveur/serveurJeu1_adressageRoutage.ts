import * as url from 'url';
import * as shell from "shelljs";

import {
    Identifiant, creerIdentifiant, egaliteIdentifiant,
    creerDateEnveloppe, creerDateMaintenant,
    TableIdentificationMutable, creerTableIdentificationMutableVide, creerTableIdentificationImmutable,
    Identification, creerIdentificationParCompteur
} from "../../bibliotheque/types";
import { } from "../../bibliotheque/outils";
import {
    binaire
} from "../../bibliotheque/binaire";
import { } from "../../bibliotheque/communication";

import { ServeurLiensWebSocket, LienWebSocket } from "../../bibliotheque/serveurConnexions";
import { ServeurApplications, Interaction } from "../../bibliotheque/serveurApplications"

import {
    hote, port1, port2, // DONE
    ReseauJeu1, creerAnneauJeu1, // DONE
    PopulationParDomaineMutable, assemblerPopulationParDomaine, // DONE
    composerErreurJeu1, FormatErreurJeu1, EtiquetteErreurJeu1,
    composerConfigurationJeu1, FormatConfigurationJeu1, EtiquetteConfigurationJeu1,
    FormatSommetJeu1, EtiquetteSommetJeu1, SommetJeu1,
    creerMessageEnveloppe, TypeMessageJeu1, FormatMessageJeu1, EtiquetteMessageJeu1, MessageJeu1,
    TableMutableUtilisateursParMessageParDomaine, creerTableMutableUtilisateurParMessageParDomaine
} from '../commun/jeu1_adressageRoutage';


class ServeurJeu1
    extends
    ServeurLiensWebSocket<
    FormatErreurJeu1, FormatErreurJeu1, EtiquetteErreurJeu1,
    FormatConfigurationJeu1, FormatConfigurationJeu1, EtiquetteConfigurationJeu1,
    FormatMessageJeu1, FormatMessageJeu1, EtiquetteMessageJeu1> { }

class LienJeu1
    extends LienWebSocket<
    FormatErreurJeu1, FormatErreurJeu1, EtiquetteErreurJeu1,
    FormatConfigurationJeu1, FormatConfigurationJeu1, EtiquetteConfigurationJeu1,
    FormatMessageJeu1, FormatMessageJeu1, EtiquetteMessageJeu1> { }

/*
 * Etat du serveur - Partie 1 :
 * - réseau
 * - Population(idDomaine, utilisateurs)
 * - connexions(idUtilisateur, lien par Web Socket)
 * - répertoire principal
 * - serveur d'applications
 * - serveur de canaux  
 * Correspondance avec la spécification : 
 * - !Population(idDomaine, listeUtilisateurs)
 * - canaux définis par connexions et type des messages
 * Remarque : le réseau n'est pas pris en compte dans la spécification 
 * car il manque des règles pour contrôler la communication.
 */

const anneau: ReseauJeu1
    = creerAnneauJeu1([binaire(0), binaire(1), binaire(2), binaire(3)]);
//const reseauConnecte: TableNoeudsJeu1 = creerTableVideNoeuds();

const utilisateursParDomaine: PopulationParDomaineMutable
    = assemblerPopulationParDomaine(anneau, [binaire(0), binaire(1)]);

const utilisateursAConnecterParDomaine: PopulationParDomaineMutable
    = assemblerPopulationParDomaine(anneau, [binaire(0), binaire(1)]);

const utilisateursConnectesParDomaine: PopulationParDomaineMutable
    = assemblerPopulationParDomaine(anneau, []);

const connexions: TableIdentificationMutable<'utilisateur', LienJeu1, LienJeu1>
    = creerTableIdentificationMutableVide<'utilisateur', LienJeu1, LienJeu1>('utilisateur', (x) => x);

const repertoireHtml: string = shell.pwd() + "/build";

const serveurAppli: ServeurApplications = new ServeurApplications(hote, port1);

const serveurCanaux = new ServeurJeu1(port2, hote);

/*
* Fin de l'état - Partie 1
*/

/*
* Configuration et démarrage du serveur d'applications
*/
serveurAppli.specifierRepertoireScriptsEmbarques("build");

{
    let racine = "/";
    let ressource = "interfaceJeu1.html";

    serveurAppli.enregistrerReponseARequeteGET(racine, (i: Interaction) => {
        let d = creerDateMaintenant()
        console.log("* " + d.representationLog() + " - Service de " + ressource + " en " + racine);
        i.servirFichier(repertoireHtml, ressource);
    });
}

serveurAppli.demarrer();

/*
* Configuration du serveur de canaux 
*/

/*
* Config 1 - Traitement des connexions
*/

serveurCanaux.enregistrerTraitementConnexion((l: LienJeu1) => {
    let ids: [Identifiant<'sommet'>, Identifiant<'utilisateur'>]; // Couple
    try {
        ids = utilisateursAConnecterParDomaine.selectionnerUtilisateur();
    } catch (e) {
        let d = creerDateMaintenant()
        console.log("* " + d.representationLog() + " - " + (<Error>e).message);
        console.log("* " + d.representationLog() + " - Connexion impossible d'un client : le réseau est complet.");
        l.envoyerMessageErreur(composerErreurJeu1(
            "Jeu 1 (adressage - routage) - Il est impossible de se connecter : le réseau est déjà complet.",
            d.val()));
        return false;
    }
    let ID_dom = ids[0];
    let ID_util = ids[1];

    if (connexions.contient(ID_util)
        || utilisateursConnectesParDomaine.contientUtilisateur(ID_dom, ID_util)) {
        let d = creerDateMaintenant()
        console.log("* " + d.representationLog() + " - Connexion impossible d'un client : le réseau est corrompu.");
        l.envoyerMessageErreur(composerErreurJeu1(
            "Jeu 1 (adressage - routage) - Réseau corrompu ! Il est impossible de se connecter : le réseau est corrompu. Contacter l'administrateur.",
            d.val()));
        return false;
    }

    // Cas où la sélection d'un utilisateur est réussie
    let d = creerDateMaintenant();
    console.log("* " + d.representationLog()
        + " - Connexion de l'utilisateur " + ID_util.val
        + " du domaine " + ID_dom.val + " par Web socket.");

    connexions.ajouter(ID_util, l);

    let n = anneau.noeud(ID_dom);
    let pop = utilisateursParDomaine.valeur(ID_dom);
    let u = utilisateursParDomaine.utilisateur(ID_dom, ID_util);
    let config = composerConfigurationJeu1(n, pop, u, d.val());

    console.log("- envoi au client d'adresse " + l.adresseClient());
    console.log("  - de la configuration brute " + config.brut());
    console.log("  - de la configuration nette " + config.representation());
    l.envoyerConfiguration(config);
    utilisateursConnectesParDomaine.ajouterUtilisateur(ID_dom, u);
    utilisateursAConnecterParDomaine.retirerUtilisateur(ID_dom, ID_util);
    return true;
});

/*
* Etat du serveur - Partie 2 (messages) :
* - Identification des messages
* - Table de verouillage : id sommet -> id message -> (PERSONNE | id utilisateur)
* - TODO à compléter ! Par exemple : consigne
*  
* Correspondance avec la spécification
* - IdentificationMsg(id) pour l'identification des messages (identificationMessages)
* - Verrou(idDomaine, idMessage, PERSONNE | idUtilisateur)*
*/
const identificationMessages: Identification<'message'> = creerIdentificationParCompteur("MSG-");
const tableVerrouillageMessagesParDomaine: TableMutableUtilisateursParMessageParDomaine
    = creerTableMutableUtilisateurParMessageParDomaine();
{
    anneau.iterer((id, n) => {
        tableVerrouillageMessagesParDomaine.ajouter(id, creerTableIdentificationMutableVide('message', (x) => x));
    });

}
const PERSONNE: Identifiant<'utilisateur'> = creerIdentifiant('utilisateur', 'LIBRE'); // sorte + valeur de l'identifiant

/*
* Config 2 - Traitement des messages
*/

// Fonctions utiles utilisées dans le traitement des messages
// TODO à revoir et compléter

function diffuser(msg: MessageJeu1): void {
    let utilisateurs = utilisateursConnectesParDomaine.valeur(msg.val().ID_destination);
    creerTableIdentificationImmutable('utilisateur', utilisateurs).iterer((idU, u) => {
        connexions.valeur(idU).envoyerAuClientDestinataire(msg);
    });
}

function accuserReception(msg: MessageJeu1): void {
    connexions.valeur(msg.val().ID_emetteur).envoyerAuClientDestinataire(msg);
}

function verrouiller(msg: MessageJeu1): void {
    /* TODO
    let utilisateurs = utilisateursConnectesParDomaine.valeur(msg.val().ID_origine);
    creerTableIdentificationImmutable('utilisateur', utilisateurs).iterer((idU, u) => {
        let ar = (egaliteIdentifiant(idU, msg.val().ID_emetteur)) ?
            TypeMessageJeu1.ACTIF : TypeMessageJeu1.INACTIF;
        connexions.valeur(idU).envoyerAuClientDestinataire(msg.avecAccuseReception(ar));
    });
    */
}

serveurCanaux.enregistrerTraitementMessages((l: LienJeu1, m: FormatMessageJeu1) => {
    console.log('TODO traitement messages');

    let msg: MessageJeu1 = creerMessageEnveloppe(m);
    console.log("* Traitement d'un message");
    console.log("- brut : " + msg.brut());
    console.log("- net : " + msg.representation());


    switch (m.type) {
        case TypeMessageJeu1.INIT:
            // TODO tester erreurs
            // TODO ajouter log            
            msg = msg.avecIdentifiant(identificationMessages.identifier('message'));
            tableVerrouillageMessagesParDomaine.valeur(msg.val().ID_destination).ajouter(msg.val().ID, PERSONNE);
            accuserReception(msg.avecAccuseReception(TypeMessageJeu1.INIT)); // TODO / spec
            diffuser(msg.sansEmetteurPourTransit()); // TODO / spec
            break;
        case TypeMessageJeu1.VERROU:
            // TODO tester erreurs.
            // TODO ajouter log
            let verrouilleur = tableVerrouillageMessagesParDomaine.valeur(msg.val().ID_origine).valeur(msg.val().ID);
            if (verrouilleur === PERSONNE) {
                tableVerrouillageMessagesParDomaine.valeur(msg.val().ID_origine).ajouter(msg.val().ID, msg.val().ID_emetteur);
                verrouiller(msg);
            } else {
                // TODO Rien à faire. 
            }
            break;
        case TypeMessageJeu1.ACTIF:
            // TODO tester erreurs.
            // TODO ajouter log
            tableVerrouillageMessagesParDomaine.valeur(msg.val().ID_origine).retirer(msg.val().ID);
            tableVerrouillageMessagesParDomaine.valeur(msg.val().ID_destination).ajouter(msg.val().ID, PERSONNE);
            accuserReception(msg.avecAccuseReception(TypeMessageJeu1.ACTIF)); // TODO Convention : AR avec même type qu'à l'émission
            diffuser(msg.sansEmetteurPourTransit());
            break;
        default:
    }

});

serveurCanaux.enregistrerTraitementFermeture((l: LienJeu1, r: number, desc: string) => {
    console.log('TODO traitement fermeture');
    /*
    let id: IdentifiantSommet = l.configuration().enJSON().centre.id;
    if ((connexions[id] === undefined) || (!reseauConnecte.possedeNoeud(id))) {
        console.log("* Impossibilité de fermer la connexion par Web socket : " + id + " est déjà déconnecté.");
        connexions[id] = l;
        return;
    }
    console.log(" * " + dateFrLog(new Date()) + " - Déconnexion du client utilisant l'adresse " + l.adresseClient() + ".");
    console.log("- identité : " + l.configuration().enJSON().centre.id);
    console.log("- raison : " + r + " ; description : " + desc);
    let n = reseauConnecte.noeud(id);
    reseauConnecte.retirerNoeud(n);
    delete connexions[id];
    anneau.ajouterNoeud(n);
    */
});

serveurCanaux.demarrer();

