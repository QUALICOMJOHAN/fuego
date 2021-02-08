module.exports = (sequelize, DataTypes) => {
    const ADV_BDC_client = sequelize.define('ADV_BDC_client', 
        {
            refIdClient : {
                type : DataTypes.NUMBER,
                allowNull : false,
                references : {
                    model : 'Clients',
                    key : 'id'
                }
            },
            intitule : {
                type : DataTypes.ENUM('M', 'MME', 'M et MME', 'Messieurs', 'Mesdames')
            },
            nom1 : {
                type : DataTypes.STRING(256),
                allowNull : false,
                validate : {
                    len : {
                        args : [1, 256],
                        msg : 'Le nom est limité à 256 caractères.'
                    },
                    notNull : {
                        msg : "Le nom du client doit être indiqué."
                    }
                }
            },
            nom2 : {
                type : DataTypes.STRING(256),
                allowNull : true,
                defaultValue : null,
                validate : {
                    len : {
                        args : [1, 256],
                        msg : 'Le nom est limité à 256 caractères.'
                    }
                }
            },
            adresse : {
                type: DataTypes.STRING(500),
                allowNull: true,
                defaultValue: '',
                validate : {
                    len : {
                        args : [0, 500],
                        msg : 'L\'adresse est limité à 500 caractères.'
                    }
                }
            },
            adresseComplement1 : {
                type: DataTypes.STRING(500),
                allowNull: true,
                defaultValue: '',
                validate : {
                    len : {
                        args : [0, 500],
                        msg : 'Le complement d\'adresse est 1 limité à 500 caractères.'
                    }
                }
            },
            adresseComplement2 : {
                type: DataTypes.STRING(500),
                allowNull: true,
                defaultValue: '',
                validate : {
                    len : {
                        args : [0, 500],
                        msg : 'Le complément d\'adresse 2 est limité à 500 caractères.'
                    }
                }
            },
            cp : {
                type: DataTypes.STRING(5),
                allowNull: false,
                validate : {
                    isNumeric : {
                        msg : 'Le code postal doit être composé de 5 chiffres.'
                    },
                    len : {
                        args : [5, 5],
                        msg : 'Le code postal doit être composé de 5 chiffres.'
                    }
                }
            },
            ville : {
                type: DataTypes.STRING(256),
                allowNull: false,
                validate : {
                    len : {
                        args : [2, 256],
                        msg : 'La ville est limité à 256 caractères.'
                    }
                }
            },
            email : {
                type: DataTypes.STRING(320),
                allowNull: false,
                validate : {
                    isEmail: {
                        msg : 'L\'adresse e-mail est incorrecte.'
                    },
                    len : {
                        args : [6, 320],
                        msg : 'L\'adresse e-mail est incorrecte.'
                    }
                }
            },
            telephonePort : {
                type: DataTypes.STRING(10),
                allowNull: false,
                validate : {
                    isPhoneNumber : value => {
                        if(value !== null && value !== '' && !value.match(/^0[6-7][0-9]{8}$/g)) {
                            throw new Error('Numéro de téléphone portable invalide.')
                        }
                    }
                }
            },
            telephoneFixe : {
                type: DataTypes.STRING(10),
                allowNull: true,
                defaultValue : null,
                validate : {
                    isPhoneNumber : value => {
                        if(value !== null && value !== '' && !value.match(/^0[1-9][0-9]{8}$/g)) {
                            throw new Error('Numéro de téléphone fixe invalide.')
                        }
                    }
                }
            },
            idClientInfoTechnique : {
                type : DataTypes.INTEGER,
                allowNull : false,
                references : {
                    model : 'ADV_BDC_clients_infoTechniques',
                    key : 'id'
                }
            }
        }, 
        {
            name : {
                singular : 'ADV_BDC_client',
                plural : 'ADV_BDC_clients'
            },
            tableName : 'ADV_BDC_clients'
        }
    )

    ADV_BDC_client.associate = models => {
        ADV_BDC_client.belongsTo(models.Client, { foreignKey: 'refClient' })
        ADV_BDC_client.belongsTo(models.ADV_BDC_client_infoTechniques, { foreignKey : 'idClientInfoTechnique' })
    }

    return ADV_BDC_client
}