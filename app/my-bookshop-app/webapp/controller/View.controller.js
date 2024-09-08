sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, MessageBox, JSONModel, MessageToast, Spreadsheet, Fragment, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("mybookshopapp.controller.View", {

        onInit: function () {
            var oUserModel = new JSONModel({
                loggedIn: false,
                username: ""
            });
            this.getView().setModel(oUserModel, "userModel");

            var oDialogModel = new JSONModel({
                isRegistering: false,
                emailState: "None",
                emailStateText: ""
            });
            this.getView().setModel(oDialogModel, "dialogModel");

            var oFilterModel = new JSONModel({
                searchTerm: "",
                priceRange: [0, 100],
                minDiscount: 0
            });
            this.getView().setModel(oFilterModel, "filterModel");
            this.checkLoginStatus();

            var oComponent = this.getOwnerComponent();
            var oModel = oComponent.getModel();
            console.log("Model initialized successfully");
            console.log("Model type:", oModel.getMetadata().getName());
            

            var oViewModel = new JSONModel({
                isTableSelectionMade: false
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Get the table and attach to its selectionChange event
            var oTable = this.byId("booksTable");
            oTable.attachSelectionChange(this.onTableSelectionChange, this);
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("main").attachPatternMatched(this.onRouteMatched, this);

        },

        onRouteMatched: function (oEvent) {
            var oComponent = this.getOwnerComponent();
            if (oComponent.needsRefresh) {
                var oModel = this.getView().getModel();
                if (oModel) {
                    // Refresh the entire model
                    oModel.refresh();
                }
                // Reset the flag
                oComponent.needsRefresh = false;
            }
        },

        onCreateBook: function () {
            if (!this.pDialog) {
                this.pDialog = this.loadFragment({
                    name: "mybookshopapp.view.CreateBook"
                });
            }
            this.pDialog.then(function (oDialog) {
                this._clearCreateBookDialog();
                oDialog.open();
            }.bind(this));
        },

        _clearCreateBookDialog: function () {
            this.byId("titleInput").setValue("");
            this.byId("descriptionInput").setValue("");
            this.byId("priceInput").setValue("");
            this.byId("stockInput").setValue("");
            this.byId("reviewsInput").setValue("");
            this.byId("ratingInput").setValue("");
            this.byId("publisherInput").setValue("");
            this.byId("genreSelect").setSelectedKey("");
            this.byId("isbnInput").setValue("");
            this.byId("countryInput").setValue("");
            this.byId("languageInput").setValue("");
            this.byId("authorSelect").setSelectedKey("");
            this.byId("imageUrlInput").setValue("");
        },

        onConfirmCreate: function () {
            var oDialog = this.byId("createBookDialog");
            var oModel = this.getView().getModel();
            var oListBinding = oModel.bindList("/Books");

            // Validate required fields
            var sTitle = this.byId("titleInput").getValue();
            var sDescription = this.byId("descriptionInput").getValue();
            var sPrice = this.byId("priceInput").getValue();
            var sStock = this.byId("stockInput").getValue();
            var sRating = this.byId("ratingInput").getValue();
            var sPublisher = this.byId("publisherInput").getValue();
            var sGenre = this.byId("genreSelect").getSelectedKey();
            var sISBN = this.byId("isbnInput").getValue();
            var sCountry = this.byId("countryInput").getValue();
            var sLanguage = this.byId("languageInput").getValue();
            var sAuthor = this.byId("authorSelect").getSelectedKey();
            var sImageUrl = this.byId("imageUrlInput").getValue();

            // Check if any required field is empty
            if (!sTitle || !sDescription || !sPrice || !sStock || !sRating || !sPublisher || !sGenre || !sISBN || !sCountry || !sLanguage || !sAuthor) {
                MessageBox.error("All fields are required");
                return;
            }

            // Proceed with creating the book object if all fields are valid
            var oNewBook = {
                title: sTitle,
                description: sDescription,
                price: parseFloat(sPrice),
                stock: parseInt(sStock, 10),
                reviews: this.byId("reviewsInput").getValue().split(";"),
                rating: parseFloat(sRating),
                publisher: sPublisher,
                genre_ID: sGenre,
                isbn: sISBN,
                countryOfOrigin: sCountry,
                language: sLanguage,
                author_ID: sAuthor,
                imageUrl: sImageUrl
            };

            oListBinding.create(oNewBook, true, null, false);

            oModel.submitBatch("$auto").then(function () {
                var oMessageModel = sap.ui.getCore().getMessageManager().getMessageModel();
                var aMessages = oMessageModel.getData();

                if (aMessages.length > 0) {
                    var sErrorMessage = aMessages.map(function (oMessage) {
                        return oMessage.message;
                    }).join("\n");
                    MessageBox.error(sErrorMessage);
                } else {
                    MessageBox.success("Book created successfully");
                    oModel.refresh();
                    oDialog.close();
                }
            }).catch(function (oError) {
                MessageBox.error("Error creating book: " + oError.message);
            });
        },

        onRatingLiveChange: function (oEvent) {
            var iValue = oEvent.getParameter("value");
            if (iValue < 1 || iValue > 5) {
                MessageToast.show("Rating must be between 1 and 5");
                oEvent.getSource().setValue("");
            }
        },

        onCancelCreate: function () {
            this.byId("createBookDialog").close();
        },

        onDeleteBook: function () {
            var oTable = this.byId("booksTable");
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageBox.warning("Please select at least one book to delete");
                return;
            }

            var oModel = this.getView().getModel();

            MessageBox.confirm("Are you sure you want to delete the selected book(s)?", {
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        aSelectedItems.forEach(function (oItem) {
                            var oContext = oItem.getBindingContext();
                            oContext.delete().catch(function (oError) {
                                MessageBox.error("Error deleting book: " + oError.message);
                            });
                        });

                        oModel.submitBatch("$auto").then(function () {
                            MessageBox.success("Selected book(s) deleted successfully");
                            oModel.refresh();
                        }).catch(function (oError) {
                            MessageBox.error("Error deleting books: " + oError.message);
                        });
                    }
                }
            });
        },

        onItemPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oRouter = this.getOwnerComponent().getRouter();
            var oContext = oItem.getBindingContext();
            var sBookId = oContext.getProperty("ID");

            oRouter.navTo("detail", {
                bookId: sBookId
            });
        },

        onOrdersPress: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("orders");
        },


        checkLoginStatus: function () {
            var oUserModel = this.getView().getModel("userModel");
            var bLoggedIn = localStorage.getItem("loggedIn") === "true";
            oUserModel.setProperty("/loggedIn", bLoggedIn);
            oUserModel.setProperty("/username", localStorage.getItem("username") || "");
            oUserModel.setProperty("/admin", localStorage.getItem("admin") === "true");
        },

        onLoginPress: function () {

            if (!this.oLoginRegisterDialog) {
                this.oLoginRegisterDialog = sap.ui.xmlfragment("mybookshopapp.view.LoginRegister", this);
                this.getView().addDependent(this.oLoginRegisterDialog);
            }
            this._clearLoginRegisterDialog();
            this.getView().getModel("dialogModel").setProperty("/isRegistering", false);
            this.oLoginRegisterDialog.open();
        },

        onLogin: function () {
            console.log("Login function called");
            var sUsername = sap.ui.getCore().byId("usernameInput").getValue();
            var sPassword = sap.ui.getCore().byId("passwordInput").getValue();

            $.ajax({
                url: "/catalog/login",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    username: sUsername,
                    password: sPassword
                }),
                success: function (oData) {
                    if (oData.success) {
                        var oUserModel = this.getView().getModel("userModel");
                        oUserModel.setProperty("/loggedIn", true);
                        oUserModel.setProperty("/username", sUsername);
                        oUserModel.setProperty("/admin", oData.admin); // Set the admin status
                        localStorage.setItem("loggedIn", "true");
                        localStorage.setItem("username", sUsername);
                        localStorage.setItem("admin", oData.admin); // Store admin status
                        this.oLoginRegisterDialog.close();
                        MessageBox.success("Login successful");
                    } else {
                        MessageBox.error("Login failed: " + oData.message);
                    }
                }.bind(this),
                error: function (jqXHR, textStatus, errorThrown) {
                    MessageBox.error("Login failed: " + errorThrown);
                }
            });
        },

        onRegister: function () {
            var sUsername = sap.ui.getCore().byId("usernameInput").getValue().trim();
            var sPassword = sap.ui.getCore().byId("passwordInput").getValue();
            var sEmail = sap.ui.getCore().byId("emailInput").getValue();
            var sFirstName = sap.ui.getCore().byId("firstNameInput").getValue();
            var sLastName = sap.ui.getCore().byId("lastNameInput").getValue();

            // Validate required fields
            if (!sUsername || !sPassword || !sEmail || !sFirstName || !sLastName) {
                MessageBox.error("All fields are required");
                return;
            }

            // Validate email format
            // var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            // if (!emailRegex.test(sEmail)) {
            //     MessageBox.error("Please enter a valid email address");
            //     return;
            // }

            $.ajax({
                url: "/catalog/register",
                type: "POST",
                contentType: "application/json",
                data: JSON.stringify({
                    username: sUsername,
                    password: sPassword,
                    email: sEmail,
                    firstName: sFirstName,
                    lastName: sLastName
                }),
                success: function (oData) {
                    if (oData.success) {
                        MessageBox.success(oData.message);
                        this.oLoginRegisterDialog.close();
                    } else {
                        MessageBox.error(oData.message);
                    }
                }.bind(this),
                error: function (jqXHR, textStatus, errorThrown) {
                    var errorMessage = "Registration failed: " + errorThrown;
                    if (jqXHR.responseJSON && jqXHR.responseJSON.message) {
                        errorMessage = jqXHR.responseJSON.message;
                    }
                    MessageBox.error(errorMessage);
                }
            });
        },

        _clearLoginRegisterDialog: function () {
            sap.ui.getCore().byId("usernameInput").setValue("");
            sap.ui.getCore().byId("passwordInput").setValue("");
            sap.ui.getCore().byId("emailInput").setValue("");
            sap.ui.getCore().byId("firstNameInput").setValue("");
            sap.ui.getCore().byId("lastNameInput").setValue("");
        },

        onSwitchMode: function () {
            var oDialogModel = this.getView().getModel("dialogModel");
            var bIsRegistering = oDialogModel.getProperty("/isRegistering");
            oDialogModel.setProperty("/isRegistering", !bIsRegistering);
        },

        onCancelDialog: function () {
            this.oLoginRegisterDialog.close();
        },

        onRegisterOrLogin: function () {
            var oDialogModel = this.getView().getModel("dialogModel");
            var bIsRegistering = oDialogModel.getProperty("/isRegistering");
            if (bIsRegistering) {
                this.onRegister();
            } else {
                this.onLogin();
            }
        },

        onTogglePasswordVisibility: function (oEvent) {
            var oPasswordInput = sap.ui.getCore().byId("passwordInput");
            var sType = oPasswordInput.getType();
            oPasswordInput.setType(sType === "Password" ? "Text" : "Password");
            oEvent.getSource().setIcon(sType === "Password" ? "sap-icon://hide" : "sap-icon://show");
        },


        onEmailLiveChange: function (oEvent) {
            var sEmail = oEvent.getParameter("value");
            var oDialogModel = this.getView().getModel("dialogModel");

         
            var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(sEmail)) {
                oDialogModel.setProperty("/emailState", "Warning");
                oDialogModel.setProperty("/emailStateText", "Not a valid email address");
            } else {
                oDialogModel.setProperty("/emailState", "Success");
                oDialogModel.setProperty("/emailStateText", "");
            }
        },

        onPasswordLiveChange: function (oEvent) {
            var sPassword = oEvent.getParameter("value");
            var oPasswordInput = oEvent.getSource();

            if (!sPassword) {
                oPasswordInput.setValueState("Error");
                oPasswordInput.setValueStateText("Password is required");
            } else if (sPassword.length < 8) {
                oPasswordInput.setValueState("Warning");
                oPasswordInput.setValueStateText("Password should be at least 8 characters");
            } else {
                oPasswordInput.setValueState("Success");
                oPasswordInput.setValueStateText("");
            }
        },

        onLogout: function () {
            var oUserModel = this.getView().getModel("userModel");
            oUserModel.setProperty("/loggedIn", false);
            oUserModel.setProperty("/username", "");
            localStorage.setItem("loggedIn", "false");
            localStorage.removeItem("username");
            MessageBox.success("Logged out successfully");
        },

        onTableSelectionChange: function (oEvent) {
            var oTable = oEvent.getSource();
            var iSelectedItems = oTable.getSelectedItems().length;
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isTableSelectionMade", iSelectedItems > 0);
        },

        onCopy: function () {
            var oTable = this.byId("booksTable");
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageToast.show("Please select at least one item to copy");
                return;
            }

            var sCopiedText = aSelectedItems.map(function (oItem) {
                var oContext = oItem.getBindingContext();
                return [
                    oContext.getProperty("ID"),
                    oContext.getProperty("title"),
                    oContext.getProperty("author/name"),
                    oContext.getProperty("price"),
                    oContext.getProperty("publisher"),
                    oContext.getProperty("genre/genreName")
                ].join("\t");
            }).join("\n");

            // Use the clipboard API to copy the text
            navigator.clipboard.writeText(sCopiedText).then(function () {
                MessageToast.show("Selected items copied to clipboard");
            }, function (err) {
                MessageBox.error("Failed to copy items: " + err);
            });
        },

        onDownload: function () {
            var oTable = this.byId("booksTable");
            var aItems = oTable.getItems();

            if (aItems.length === 0) {
                MessageToast.show("No items to download");
                return;
            }

            var sContent = aItems.map(function (oItem) {
                var oContext = oItem.getBindingContext();
                return [
                    oContext.getProperty("ID"),
                    oContext.getProperty("title"),
                    oContext.getProperty("author/name"),
                    oContext.getProperty("price"),
                    oContext.getProperty("publisher"),
                    oContext.getProperty("genre/genreName")
                ].join(",");
            }).join("\n");

            var sHeader = "ID,Title,Author,Price,Publisher,Genre\n";
            var sBlob = new Blob([sHeader + sContent], { type: "text/csv;charset=utf-8;" });
            var sLink = document.createElement("a");

            if (sLink.download !== undefined) {
                var sUrl = URL.createObjectURL(sBlob);
                sLink.setAttribute("href", sUrl);
                sLink.setAttribute("download", "books.csv");
                sLink.style.visibility = 'hidden';
                document.body.appendChild(sLink);
                sLink.click();
                document.body.removeChild(sLink);
            }
        },

        onExportToExcel: function () {
            var oTable = this.byId("booksTable");
            var oBinding = oTable.getBinding("items");
            var oModel = oBinding.getModel();

            var aCols = [{
                label: 'ID',
                property: 'ID',
                type: 'string'
            }, {
                label: 'Title',
                property: 'title',
                type: 'string'
            }, {
                label: 'Author',
                property: 'author/name',
                type: 'string'
            }, {
                label: 'Price',
                property: 'price',
                type: 'number'
            }, {
                label: 'Publisher',
                property: 'publisher',
                type: 'string'
            }, {
                label: 'Genre',
                property: 'genre/genreName',
                type: 'string'
            }];

            var oSettings = {
                workbook: {
                    columns: aCols
                },
                dataSource: oBinding,
                fileName: 'Books.xlsx'
            };

            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().then(function () {
                MessageToast.show('Excel file exported successfully');
            }).finally(function () {
                oSheet.destroy();
            });
        },

        onSearch: function () {
            this._applyFilters();
        },

        onOpenFilters: function () {
            var oView = this.getView();

            if (!this._pFilterDialog) {
                this._pFilterDialog = Fragment.load({
                    id: oView.getId(),
                    name: "mybookshopapp.view.FilterDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pFilterDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onClearFilters: function () {
            var oFilterModel = this.getView().getModel("filterModel");
            oFilterModel.setData({
                searchTerm: "",
                priceRange: [0, 100],
                minDiscount: 0
            });
            this._applyFilters();
        },

        onApplyFilters: function () {
            this._applyFilters();
            this._pFilterDialog.then(function (oDialog) {
                oDialog.close();
            });
        },

        onCancelFilters: function () {
            this._pFilterDialog.then(function (oDialog) {
                oDialog.close();
            });
        },

        _applyFilters: function () {
            var oTable = this.byId("booksTable");
            var oBinding = oTable.getBinding("items");
            var oFilterModel = this.getView().getModel("filterModel");
            var oFilterData = oFilterModel.getData();

            var aFilters = [];

            // Search filter
            if (oFilterData.searchTerm) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("title", FilterOperator.Contains, oFilterData.searchTerm),
                        new Filter("author/name", FilterOperator.Contains, oFilterData.searchTerm)
                    ],
                    and: false
                }));
            }

            // Price filter
            aFilters.push(new Filter("price", FilterOperator.BT, oFilterData.priceRange[0], oFilterData.priceRange[1]));

            // Discount filter
            aFilters.push(new Filter("discount", FilterOperator.GE, oFilterData.minDiscount));

            oBinding.filter(aFilters);
        }
    });
});