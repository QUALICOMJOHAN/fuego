module.exports = (sequelize, DataTypes) => {
    const ProduitBusiness_Prestation = sequelize.define('ProduitBusiness_Prestation', 
        {
            id : {
                type : DataTypes.INTEGER,
                allowNull : false,
                primaryKey: true,
                autoIncrement : true
            },
            idPrestation : {
                type : DataTypes.INTEGER,
                allowNull : false,
                validate : {
                    notNull : {
                        msg : "La prestation liée au produit doit être fournie."
                    }
                }
            },
            idProduit : {
                type : DataTypes.INTEGER,
                allowNull : false,
                validate : {
                    notNull : {
                        msg : "Le produit lié à la prestation doit être fourni."
                    }
                }
            },
            designation : {
                type : DataTypes.STRING(256),
                allowNull : false,
                validate : {
                    len : {
                        args : [1, 256],
                        msg : 'La désigantion est limitée à 256 caractères.'
                    }
                }
            },
            quantite : {
                type : DataTypes.INTEGER,
                allowNull : false,
                validate : {
                    min : {
                        args : 1,
                        msg : "La quantité doit être positive."
                    },
                    notNull : {
                        msg : "La quantité doit être indiquée."
                    }
                }
            }
        }, 
        {
            name : {
                singular : 'ProduitBusiness_Prestation',
                plural : 'ProduitsBusiness_Prestations'
            },
            tableName : 'ProduitsBusiness_Prestations'
        }
    )

    ProduitBusiness_Prestation.associate = models => {
        ProduitBusiness_Prestation.belongsTo(models.Prestation, { foreignKey : 'idPrestation' })
        ProduitBusiness_Prestation.belongsTo(models.ProduitBusiness, { foreignKey : 'idProduit' })
    }

    return ProduitBusiness_Prestation
}