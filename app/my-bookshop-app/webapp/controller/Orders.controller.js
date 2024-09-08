sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/library"  // Import the library
], function (Controller, JSONModel, MessageBox, MessageToast, mLibrary) {
    "use strict";

    var ButtonType = mLibrary.ButtonType;

    return Controller.extend("mybookshopapp.controller.Orders", {
        onInit: function () {
            var oUserModel = new JSONModel({
                loggedIn: false,
                username: "",
                admin: false
            });

            this.getView().setModel(oUserModel, "userModel");

            // Restore user state from localStorage
            this._restoreUserState();

            console.log("Order view initialized. Admin status:", oUserModel.getProperty("/admin"));
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

        onNavBack: function() {
            var oHistory = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo("home", {}, true);
            }
        },


        formatDate: function (sDate) {
            if (!sDate) {
                return "";
            }
            var oDate = new Date(sDate);
            var oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                style: "medium"
            });
            return oDateFormat.format(oDate);
        },

        formatCurrency: function (fAmount) {
            if (fAmount === undefined || fAmount === null) {
                return "N/A";
            }
            return parseFloat(fAmount).toFixed(2) + " €";
        },

        isStatusChangeable: function (sStatus) {
            var oUserModel = this.getView().getModel("userModel");
            var isAdmin = oUserModel.getProperty("/admin");
            return !!(isAdmin && sStatus !== "Delivered" && sStatus !== "Rejected" && sStatus !== "Canceled");
        },

        onChangeStatus: function (oEvent) {
            var oButton = oEvent.getSource();
            this.currentOrderContext = oButton.getBindingContext();
            var that = this;

            if (!this.statusActionSheet) {
                this.statusActionSheet = new sap.m.ActionSheet({
                    title: "Change Status",
                    buttons: [
                        new sap.m.Button({
                            text: "Pending",
                            type: ButtonType.Warning,
                            press: function () {
                                that.updateOrderStatus("Pending");
                            }
                        }),
                        new sap.m.Button({
                            text: "Dispatched",
                            type: ButtonType.Emphasized,
                            press: function () {
                                that.updateOrderStatus("Dispatched");
                            }
                        }),
                        new sap.m.Button({
                            text: "Delivered",
                            type: ButtonType.Success,
                            press: function () {
                                that.updateOrderStatus("Delivered");
                            }
                        }),
                        new sap.m.Button({
                            text: "Rejected",
                            type: ButtonType.Negative,
                            press: function () {
                                that.updateOrderStatus("Rejected");
                            }
                        })
                    ]
                });
            }

            this.statusActionSheet.openBy(oButton);
        },

        updateOrderStatus: function (sNewStatus) {
            // Update the status of the order
            this.currentOrderContext.setProperty("status", sNewStatus);

            // Submit the changes to the backend
            this.currentOrderContext.getModel().submitBatch("$auto")
                .then(function () {
                    MessageToast.show("Order status updated to " + sNewStatus);
                })
                .catch(function (oError) {
                    MessageBox.error("Error updating order status: " + oError.message);
                    console.error("Error updating order status:", oError);
                });
        }
    });
});
