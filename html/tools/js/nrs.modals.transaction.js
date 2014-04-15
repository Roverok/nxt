var NRS = (function(NRS, $, undefined) {
	$("#transactions_table, #dashboard_transactions_table").on("click", "a[data-transaction]", function(e) {
		e.preventDefault();

		var transactionId = $(this).data("transaction");

		NRS.showTransactionModal(transactionId);
	});

	NRS.showTransactionModal = function(transaction) {
		if (NRS.fetchingModalData) {
			return;
		}

		NRS.fetchingModalData = true;

		$("#transaction_info_output").html("").hide();
		$("#transaction_info_table").hide();
		$("#transaction_info_table tbody").empty();

		if (typeof transaction != "object") {
			NRS.sendRequest("getTransaction", {
				"transaction": transaction
			}, function(response, input) {
				response.id = input.transaction;
				NRS.processTransactionModalData(response);
			});
		} else {
			NRS.processTransactionModalData(transaction);
		}
	}

	NRS.processTransactionModalData = function(transaction) {
		var async = false;

		var transactionDetails = $.extend({}, transaction);
		delete transactionDetails.attachment;
		if (transactionDetails.referencedTransaction == "0") {
			delete transactionDetails.referencedTransaction;
		}
		delete transactionDetails.id;

		$("#transaction_info_modal_transaction").html(String(transaction.id).escapeHTML());

		$("#transaction_info_tab_link").tab("show");

		$("#transaction_info_details_table tbody").append(NRS.createInfoTable(transactionDetails, true));

		var incorrect = false;

		if (transaction.type == 1) {
			switch (transaction.subtype) {
				case 0:
					var hex = transaction.attachment.message;

					//password: return {"requestType": "sendMessage", "data": data};

					var message;

					if (hex.indexOf("4352595054454421") === 0) { //starts with CRYPTED!
						NRS.sendRequest("getAccountPublicKey", {
							"account": (transaction.recipient == NRS.account ? transaction.sender : transaction.recipient)
						}, function(response) {
							if (!response.publicKey) {
								$.growl("Could not find public key for recipient, which is necessary for sending encrypted messages.", {
									"type": "danger"
								});
							}

							message = NRS.decryptMessage("return {\"requestType\": \"sendMessage\", \"data\": data};", response.publicKey, hex);
						}, false);
					} else {
						try {
							message = converters.hexStringToString(hex);
						} catch (err) {
							message = "Could not convert hex to string: " + hex;
						}
					}

					var sender_info = "";

					if (transaction.sender == NRS.account || transaction.recipient == NRS.account) {
						if (transaction.sender == NRS.account) {
							sender_info = "<strong>To</strong>: " + NRS.getAccountTitle(transaction.recipient);
						} else {
							sender_info = "<strong>From</strong>: " + NRS.getAccountTitle(transaction.sender);
						}
					} else {
						sender_info = "<strong>To</strong>: " + NRS.getAccountTitle(transaction.recipient) + "<br />";
						sender_info += "<strong>From</strong>: " + NRS.getAccountTitle(transaction.sender);
					}

					$("#transaction_info_output").html(message.escapeHTML().nl2br() + "<br /><br />" + sender_info).show();
					break;
				case 1:
					var data = {
						"Type": "Alias Assignment",
						"Alias": transaction.attachment.alias,
						"URI": transaction.attachment.uri
					};

					if (transaction.sender != NRS.account) {
						data["Sender"] = NRS.getAccountTitle(transaction.sender);
					}

					$("#transaction_info_table tbody").append(NRS.createInfoTable(data));
					$("#transaction_info_table").show();

					break;
				case 2:
					var data = {
						"Type": "Poll Creation",
						"Name": transaction.attachment.name,
						"Description": transaction.attachment.description
					};

					if (transaction.sender != NRS.account) {
						data["Sender"] = NRS.getAccountTitle(transaction.sender);
					}

					$("#transaction_info_table tbody").append(NRS.createInfoTable(data));
					$("#transaction_info_table").show();

					break;
				case 3:
					var data = {
						"Type": "Vote Casting"
					};

					if (transaction.sender != NRS.account) {
						data["Sender"] = NRS.getAccountTitle(transaction.sender);
					}

					$("#transaction_info_table tbody").append(NRS.createInfoTable(data));
					$("#transaction_info_table").show();
					break;
				default:
					incorrect = true;
					break;
			}
		} else if (transaction.type == 2) {
			switch (transaction.subtype) {
				case 0:
					var data = {
						"Type": "Asset Issuance",
						"Name": transaction.attachment.name,
						"QuantityFormatted": NRS.formatQuantity(transaction.attachment.quantityQNT, transaction.attachment.decimals),
						"Decimals": transaction.attachment.decimals,
						"Description": transaction.attachment.description
					};

					if (transaction.sender != NRS.account) {
						data["Sender"] = NRS.getAccountTitle(transaction.sender);
					}

					$("#transaction_info_table tbody").append(NRS.createInfoTable(data));
					$("#transaction_info_table").show();

					break;
				case 1:
					async = true;

					NRS.sendRequest("getAsset", {
						"asset": transaction.attachment.asset
					}, function(asset, input) {
						var data = {
							"Type": "Asset Transfer",
							"Asset Name": asset.name,
							"Quantity": transaction.attachment.quantity
						};

						data["Sender"] = NRS.getAccountTitle(transaction.sender);
						data["Recipient"] = NRS.getAccountTitle(transaction.recipient);

						$("#transaction_info_table tbody").append(NRS.createInfoTable(data));
						$("#transaction_info_table").show();

						$("#transaction_info_modal").modal("show");
						NRS.fetchingModalData = false;
					});

					break;
				case 2:
					async = true;

					NRS.sendRequest("getAsset", {
						"asset": transaction.attachment.asset
					}, function(asset, input) {
						var data = {
							"Type": "Ask Order Placement",
							"Asset Name": asset.name,
							"Quantity": transaction.attachment.quantity,
							"Price": transaction.attachment.price,
							"Total": transaction.attachment.quantity * transaction.attachment.price
						};

						if (transaction.sender != NRS.account) {
							data["Sender"] = NRS.getAccountTitle(transaction.sender);
						}

						$("#transaction_info_table tbody").append(NRS.createInfoTable(data));
						$("#transaction_info_table").show();

						$("#transaction_info_modal").modal("show");
						NRS.fetchingModalData = false;
					});

					break;
				case 3:
					async = true;

					NRS.sendRequest("getAsset", {
						"asset": transaction.attachment.asset
					}, function(asset, input) {
						var data = {
							"Type": "Bid Order Placement",
							"Asset Name": asset.name,
							"Quantity": transaction.attachment.quantity,
							"Price": transaction.attachment.price,
							"Total": transaction.attachment.quantity * transaction.attachment.price
						};

						if (transaction.sender != NRS.account) {
							data["Sender"] = NRS.getAccountTitle(transaction.sender);
						}

						$("#transaction_info_table tbody").append(NRS.createInfoTable(data));
						$("#transaction_info_table").show();

						$("#transaction_info_modal").modal("show");
						NRS.fetchingModalData = false;
					});

					break;
				case 4:
					async = true;

					NRS.sendRequest("getTransaction", {
						"transaction": transaction.attachment.order
					}, function(transaction, input) {
						if (transaction.attachment.asset) {
							NRS.sendRequest("getAsset", {
								"asset": transaction.attachment.asset
							}, function(asset) {
								var data = {
									"Type": "Ask Order Cancellation",
									"Asset Name": asset.name,
									"Quantity": transaction.attachment.quantity,
									"Price": transaction.attachment.price,
									"Total": transaction.attachment.quantity * transaction.attachment.price
								};

								if (transaction.sender != NRS.account) {
									data["Sender"] = NRS.getAccountTitle(transaction.sender);
								}

								$("#transaction_info_table tbody").append(NRS.createInfoTable(data));
								$("#transaction_info_table").show();

								$("#transaction_info_modal").modal("show");
								NRS.fetchingModalData = false;
							});
						} else {
							NRS.fetchingModalData = false;
						}
					});

					break;
				case 5:
					async = true;

					NRS.sendRequest("getTransaction", {
						"transaction": transaction.attachment.order
					}, function(transaction) {
						if (transaction.attachment.asset) {
							NRS.sendRequest("getAsset", {
								"asset": transaction.attachment.asset
							}, function(asset) {
								var data = {
									"Type": "Bid Order Cancellation",
									"Asset Name": asset.name,
									"Quantity": transaction.attachment.quantity,
									"Price": transaction.attachment.price,
									"Total": transaction.attachment.quantity * transaction.attachment.price
								};

								if (transaction.sender != NRS.account) {
									data["Sender"] = NRS.getAccountTitle(transaction.sender);
								}

								$("#transaction_info_table tbody").append(NRS.createInfoTable(data));
								$("#transaction_info_table").show();

								$("#transaction_info_modal").modal("show");
								NRS.fetchingModalData = false;
							});
						} else {
							NRS.fetchingModalData = false;
						}
					});

					break;
				default:
					incorrect = true;
					break;
			}
		}

		if (incorrect) {
			NRS.fetchingModalData = false;
			return;
		}

		if (!async) {
			$("#transaction_info_modal").modal("show");
			NRS.fetchingModalData = false;
		}
	}

	return NRS;
}(NRS || {}, jQuery));