const express = require('express')
const router = express.Router()

router
.use('/typesPaiement', require('./typesPaiement'))
.use('/poles', require('./poles'))
.use('/clientsBusiness', require('./clientsBusiness'))
.use('/produitsBusiness', require('./produitsBusiness').router)
.use('/prestations', require('./prestations').router)
.use('/produitsBusiness_prestations', require('./produitsBusiness_prestations').router)
.use('/devis', require('./devis').router)
.use('/factures', require('./factures'))

module.exports = router