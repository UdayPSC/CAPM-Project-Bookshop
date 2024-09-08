sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/routing/History",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (Controller, History, JSONModel, MessageBox) {
    "use strict";

    return Controller.extend("mybookshopapp.controller.Detail", {
        onInit: function () {
            var oViewModel = new JSONModel({
                isEditing: false
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Initialize user model
            var oUserModel = new JSONModel({
                loggedIn: false,
                username: "",
                admin: false
            });
            var oOrderModel = new JSONModel({
                quantity: 1
            });
            this.getView().setModel(oOrderModel, "orderModel");
            this.getView().setModel(oUserModel, "userModel");

            // Restore user state from localStorage
            

            console.log("Detail view initialized. Admin status:", oUserModel.getProperty("/admin"));

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("detail").attachPatternMatched(this._onObjectMatched, this);

            this._initOrderModel();
        },

        _initOrderModel: function () {
            var oOrderModel = new JSONModel({
                orders: []
            });
            this.getView().setModel(oOrderModel, "orderModel");
        },

        _restoreUserState: function () {
            var oUserModel = this.getView().getModel("userModel");
            var bLoggedIn = localStorage.getItem("loggedIn") === "true";
            var sUsername = localStorage.getItem("username") || "";
            var bAdmin = localStorage.getItem("admin") === "true";

            oUserModel.setData({
                loggedIn: bLoggedIn,
                username: sUsername,
                admin: bAdmin
            });

            console.log("User state restored. Admin status:", bAdmin);
        },

        _onObjectMatched: function (oEvent) {
            var sBookId = oEvent.getParameter("arguments").bookId;
            var oView = this.getView();
            

            // Check if refresh is needed
            if (this.getOwnerComponent().needsRefresh) {
                oView.getModel().refresh(true); // This will refresh the data binding
                this.getOwnerComponent().needsRefresh = false; // Reset the flag
            }

            oView.bindElement({
                path: "/Books(" + sBookId + ")",
                events: {
                    dataReceived: function () {
                        this._fetchOrderHistory();
                        this._restoreUserState();
                    }.bind(this)
                }
            });
        },


        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("main", {}, true);
            }

            // Trigger refresh of the detail view if coming back to it
            this.getOwnerComponent().needsRefresh = true;
        },


        onEdit: function () {
            var oUserModel = this.getView().getModel("userModel");
            console.log("onEdit called. Admin status:", oUserModel.getProperty("/admin"));
            if (oUserModel.getProperty("/admin")) {
                this._toggleEditMode(true);
            } else {
                MessageBox.error("You don't have permission to edit this book.");
            }
        },

        onCancel: function () {
            var oBinding = this.getView().getBindingContext();
            if (oBinding) {
                oBinding.resetChanges();
                this._toggleEditMode(false);
            }
        },

        onSave: function () {
            var oContext = this.getView().getBindingContext();
            var that = this;

            if (oContext) {
                var oData = {
                    price: parseFloat(this.byId("priceInput").getValue()),
                    stock: parseInt(this.byId("stockInput").getValue(), 10),
                    rating: parseFloat(this.byId("_IDGenRatingIndicator1").getValue()),
                    discount: parseFloat(this.byId("discountInput").getValue())
                };


                Object.keys(oData).forEach(function (sProperty) {
                    oContext.setProperty(sProperty, oData[sProperty]);
                });


                oContext.getModel().submitBatch("$auto").then(function () {
                    MessageBox.success("Book details updated successfully");
                    that._toggleEditMode(false);
                }).catch(function (oError) {
                    MessageBox.error("Error updating book details: " + oError.message);
                });
            } else {
                MessageBox.error("No binding context available");
            }
        },


        onPlaceOrder: function () {
            var oUserModel = this.getView().getModel("userModel");
            var oContext = this.getView().getBindingContext();
            

            var sUsername = oUserModel.getProperty("/username");
            if (!sUsername) {
                MessageBox.error("User is not logged in. Please log in to place an order.");
                return;
            }

            if (!oContext) {
                MessageBox.error("No binding context available");
                return;
            }

            // Get the quantity from the StepInput field directly
            var iQuantity = parseInt(this.getView().byId("quantityInput").getValue(), 10);
            if (iQuantity <= 0 || iQuantity > oContext.getProperty("stock")) {
                MessageBox.error("Invalid quantity. Please enter a number between 1 and " + oContext.getProperty("stock"));
                return;
            }

            var oModel = this.getView().getModel();

            var oOrderData = {
                username: sUsername,
                items: [{
                    bookId: parseInt(oContext.getProperty("ID"), 10),
                    quantity: iQuantity
                }]
            };

            console.log("Order data:", JSON.stringify(oOrderData));

            // Create a new context for the action
            var oActionContext = oModel.bindContext("/placeOrder(...)");

            // Set the parameters for the action
            oActionContext.setParameter("username", sUsername);
            oActionContext.setParameter("items", oOrderData.items);

            // Execute the action
            oActionContext.execute().then(function () {
                // The action has been executed successfully
                return oActionContext.getBoundContext().requestObject();
            }).then(function (oResult) {
                console.log("Server response:", oResult);
                if (oResult && oResult.success) {
                    var message = oResult.message || 'Order Placed Successfully';
                    var bookNames = oResult.bookNames || 'Unknown';
                    var orderId = oResult.orderId ? `Order ID: ${oResult.orderId}, ` : '';
                    MessageBox.success(`${message}. ${orderId}Book Name: ${bookNames}`);
                } else {
                    MessageBox.error(oResult?.message || "Unexpected response format");
                }
            }).catch(function (oError) {
                console.error("Error details:", oError);
                MessageBox.error("Error while placing order: " + (oError.message || "Unknown error occurred"));
            });
        },



        _toggleEditMode: function (bEdit) {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isEditing", bEdit);
            var oForm = this.byId("bookForm");
            if (oForm) {
                oForm.setEditable(bEdit);
            }
            var oOrderButton = this.byId("placeOrderButton");
            var oQuantityInput = this.byId("quantityInput");
            if (oOrderButton && oQuantityInput) {
                oOrderButton.setVisible(!bEdit);
                oQuantityInput.setVisible(!bEdit);
            }
        },

        _fetchOrderHistory: function () {
            var oUserModel = this.getView().getModel("userModel");
            var oBookContext = this.getView().getBindingContext();
            var that = this;

            if (oUserModel.getProperty("/loggedIn") && oBookContext) {
                var iBookId = oBookContext.getProperty("ID");
                var sUsername = oUserModel.getProperty("/username");

                // Create a new context for the action
                var oActionContext = this.getView().getModel().bindContext("/fetchOrderHistory(...)");

                // Set the parameters for the action
                oActionContext.setParameter("bookId", iBookId);
                oActionContext.setParameter("username", sUsername);

                // Execute the action
                oActionContext.execute().then(function () {
                    return oActionContext.getBoundContext().requestObject();
                }).then(function (oResult) {
                    var oOrderModel = that.getView().getModel("orderModel");

                    if (oResult && oResult.success) {
                        // Update orderModel with orderHistory
                        oOrderModel.setProperty("/orders", oResult.orderHistory);

                        // Optional: Handle the case where there are no orders
                        if (oResult.orderHistory.length === 0) {
                            // You can update some visibility or status here if needed
                            console.log("No orders found for this book.");
                        }
                    } else {
                        MessageBox.error(oResult?.message || "Failed to fetch order history");
                        oOrderModel.setProperty("/orders", []); // Ensure it resets to empty
                    }
                }).catch(function (oError) {
                    MessageBox.error("Error while fetching order history: " + (oError.message || "Unknown error occurred"));
                    var oOrderModel = that.getView().getModel("orderModel");
                    oOrderModel.setProperty("/orders", []); // Ensure it resets to empty
                });
            } else {
                var oOrderModel = this.getView().getModel("orderModel");
                oOrderModel.setProperty("/orders", []); // Ensure it resets to empty
            }
        },

        onCancelOrder: function (oEvent) {
            var oSelectedItem = oEvent.getSource().getBindingContext("orderModel");
            if (!oSelectedItem) {
                sap.m.MessageBox.error("Unable to retrieve order details.");
                return;
            }

            var sOrderId = oSelectedItem.getProperty("id");

            if (!sOrderId) {
                sap.m.MessageBox.error("Order ID is missing.");
                return;
            }

            var that = this;

            // Confirm the cancellation action with the user
            sap.m.MessageBox.confirm("Are you sure you want to cancel this order?", {
                title: "Cancel Order",
                onClose: function (oAction) {
                    if (oAction === sap.m.MessageBox.Action.OK) {
                        var oActionContext = that.getView().getModel().bindContext("/cancelOrder(...)");

                        // Set the parameters for the action
                        oActionContext.setParameter("orderId", sOrderId);

                        // Execute the action
                        oActionContext.execute().then(function () {
                            return oActionContext.getBoundContext().requestObject();
                        }).then(function (oResult) {
                            if (oResult && oResult.success) {
                                // Show a success message
                                sap.m.MessageBox.success("Order canceled successfully.");

                                // Refresh the order history to reflect changes
                                that._fetchOrderHistory();
                            } else {
                                sap.m.MessageBox.error(oResult?.message || "Failed to cancel order");
                            }
                        }).catch(function (oError) {
                            sap.m.MessageBox.error("Error while canceling order: " + (oError.message || "Unknown error occurred"));
                        });
                    }
                }
            });
        }

    });
});