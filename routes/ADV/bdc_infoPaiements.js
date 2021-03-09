const express = require('express')
const router = express.Router()
const models = global.db
const { ADV_BDC_infoPaiement, ADV_BDC_client } = models
const { Op } = require('sequelize')
const { error } = require('winston')
const errorHandler = require('../utils/errorHandler')
const isSet = require('../utils/isSet')
const validations = require('../utils/validations')

async function checkInfosPaiement(infosPaiement) {
    if(!isSet(infosPaiement)) throw "Les informations de paiement doivent être transmises."
    
    // vérification de l'acompte
    if(isSet(infosPaiement.isAcompte) && !!infosPaiement.isAcompte) {
        infosPaiement.isAcompte = !!infosPaiement.isAcompte
        if(!isSet(infosPaiement.typeAcompte)) throw "Le type d'acompte doit être sélectionné."
        if(!['CHÈQUE', 'ESPÈCES'].includes(infosPaiement.typeAcompte)) throw "Le type d'acompte doit être dans la liste fournie."
        infosPaiement.montantAcompte = validations.validationNumbers(infosPaiement.montantAcompte, "Le montant de l'acompte")
    }
    else if((!isSet(infosPaiement.isAcompte) || !!!infosPaiement.isAcompte) && (isSet(infosPaiement.typeAcompte) || isSet(infosPaiement.montantAcompte))) throw "Acompte doit être sélectionné." 
    else {
        infosPaiement.isAcompte = false
        infosPaiement.typeAcompte = null
        infosPaiement.montantAcompte = 0
    }

    // vérification du paiement comptant
    if(isSet(infosPaiement.isComptant) && !!infosPaiement.isComptant) {
        infosPaiement.isComptant = !!infosPaiement.isComptant
        infosPaiement.montantComptant = validations.validationNumbers(infosPaiement, "Le montant du paiement comptant")
    }
    else if((!isSet(infosPaiement.isComptant) || !!!infosPaiement.isComptant) && isSet(infosPaiement.montantComptant)) throw "Paiement comptant doit être sélectionné."
    else {
        infosPaiement.isComptant = false
        infosPaiement.montantComptant = 0
    }

    // vérification du crédit
    if(isSet(infosPaiement.isCredit) && !!infosPaiement.isCredit) {
        infosPaiement.isCredit = !!infosPaiement.isCredit
        infosPaiement.montantCredit = validations.validationNumbers(infosPaiement.montantCredit, "Le montant du crédit")
        infosPaiement.nbMensualiteCredit = validations.validationInteger(infosPaiement.nbMensualiteCredit, "Le nombre de mensualités du crédit")
        infosPaiement.montantMensualiteCredit = validations.validationNumbers(infosPaiement.montantMensualiteCredit, "Le montant des mensualités du crédit")
        infosPaiement.nbMoisReportCredit = validations.validationInteger(infosPaiement.nbMoisReportCredit, "Le nombre de mois de report du crédit")
        infosPaiement.tauxNominalCredit = validations.validationNumbers(infosPaiement.tauxNominalCredit, "Le taux nominal du crédit")
        infosPaiement.tauxEffectifGlobalCredit = validations.validationNumbers(infosPaiement.tauxEffectifGlobalCredit, "Le taux effectif global du crédit")
        infosPaiement.datePremiereEcheanceCredit = validations.validationDateFullFR(infosPaiement.datePremiereEcheanceCredit, "La date de première échéance du crédit")
        infosPaiement.coutTotalCredit = validations.validationNumbers(infosPaiement.coutTotalCredit, "Le coût total du crédit")
    }
    else if(
        (!isSet(infosPaiement.isCredit) || !!!infosPaiement.isCredit) && 
        (
            isSet(infosPaiement.montantCredit) || isSet(infosPaiement.nbMensualiteCredit) || isSet(infosPaiement.montantMensualiteCredit) || isSet(infosPaiement.nbMoisReportCredit) ||
            isSet(infosPaiement.tauxNominalCredit) || isSet(infosPaiement.tauxEffectifGlobalCredit) || isSet(infosPaiement.datePremiereEcheanceCredit) || isSet(infosPaiement.coutTotalCredit)
        )
    ) throw "Paiement via un organisme de crédit doit être sélectionné."
    else {
        infosPaiement.isCredit = false
        infosPaiement.montantCredit = 0
        infosPaiement.nbMensualiteCredit = 0
        infosPaiement.montantMensualiteCredit = 0
        infosPaiement.nbMoisReportCredit = 0
        infosPaiement.tauxNominalCredit = 0
        infosPaiement.tauxEffectifGlobalCredit = 0
        infosPaiement.datePremiereEcheanceCredit = null
        infosPaiement.coutTotalCredit = 0
    }

    if((!isSet(infosPaiement.isAcompte) || !!!infosPaiement.isAcompte) && (!isSet(infosPaiement.isComptant) || !!!infosPaiement.isComptant) && (!isSet(infosPaiement.isCredit) || !!!infosPaiement.isCredit))
    throw "Un ou plusieurs modes de réglement doivent être sélectionnés."

    // vérification du client
    if(!isSet(infosPaiement.idADV_BDC_client) || isNaN(Number(infosPaiement.idADV_BDC_client))) throw "L'identifiant du client doit être transmis."
    infosPaiement.idADV_BDC_client = Number(infosPaiement.idADV_BDC_client)
    const client = ADV_BDC_client.findOne({
        where : {
            id : infosPaiement.idADV_BDC_client
        }
    })
    if(client === null) throw "Aucun client correspondant à l'identifiant transmis."    

    return infosPaiement
}

async function create_BDC_infosPaiement(infosPaiementSent) {
    await checkInfosPaiement(infosPaiementSent)

    const infosPaiement = await ADV_BDC_infoPaiement.create(infosPaiementSent)
    if(client === null) throw "Une erreur est survenue lors de l'enregistrement des informations de paiement."

    return infosPaiement
}

router
// récupère une information de paiement
.get('/:Id_InfosPaiement', async (req, res) => {
    const Id_InfosPaiement = Number(req.params.Id_InfosPaiement)

    let infos = undefined
    let infosPaiement = undefined

    try {
        if(isNaN(Id_InfosPaiement)) throw "L'identifiant des informations de paiement est incorrect."

        infosPaiement = await ADV_BDC_infoPaiement.findOne({
            where : {
                id : Id_InfosPaiement
            }
        })
        if(infosPaiement === null) throw "Une erreur est survenue lors de la récupération des informations de paiement."
    }
    catch(error) {
        infosPaiement = undefined
        infos = errorHandler(error)
    }

    res.sendStatus({
        infos,
        infosPaiement
    })

})
.get('/checkInfosPaiement', async (req, res) => {
    let infos = undefined

    try {
        await checkInfosPaiement(req.body)

        infos = errorHandler(undefined, 'ok')
    }
    catch(error) {
        infos = errorHandler(error)
    }

    res.send({
        infos
    })
})

module.exports = {
    router,
    checkInfosPaiement,
    create_BDC_infosPaiement
}