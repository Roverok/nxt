var NRS = (function(NRS, $, undefined) {
	NRS.getBlock = function(blockID, callback, async) {
		NRS.sendRequest('getBlock', {
			"block": blockID
		}, function(response) {
			if (response.errorCode && response.errorCode == -1) {
				NRS.getBlock(blockID, callback, async);
			} else {
				if (callback) {
					response.id = blockID;
					callback(response);
				}
			}
		}, (async == undefined ? true : async));
	}

	NRS.handleInitialBlocks = function(response) {
		if (response.errorCode) {
			return;
		}

		NRS.blocks.push(response);
		if (NRS.blocks.length < 10 && response.previousBlock) {
			NRS.getBlock(response.previousBlock, NRS.handleInitialBlocks);
		} else {
			NRS.lastBlockHeight = NRS.blocks[0].height;

			NRS.useNQT = (NRS.isTestNet || NRS.lastBlockHeight >= 150000);

			if (NRS.state && NRS.state.time - NRS.blocks[0].timestamp > 60 * 60 * 30) {
				NRS.downloadingBlockchain = true;
				$("#downloading_blockchain, #nrs_update_explanation_blockchain_sync").show();
				$("#show_console").hide();
				NRS.calculateBlockchainDownloadTime(function() {
					NRS.updateBlockchainDownloadProgress();
				});
			}

			var rows = "";

			for (var i = 0; i < NRS.blocks.length; i++) {
				var block = NRS.blocks[i];

				if (NRS.useNQT) {
					block.totalAmount = new BigInteger(block.totalAmountNQT);
					block.totalFee = new BigInteger(block.totalFeeNQT);
				}

				rows += "<tr><td>" + (block.numberOfTransactions > 0 ? "<a href='#' data-block='" + String(block.height).escapeHTML() + "' class='block' style='font-weight:bold'>" + String(block.height).escapeHTML() + "</a>" : String(block.height).escapeHTML()) + "</td><td>" + NRS.formatTimestamp(block.timestamp) + "</td><td>" + NRS.formatAmount(block.totalAmount) + " + " + NRS.formatAmount(block.totalFee) + "</td><td>" + block.numberOfTransactions + "</td></tr>";
			}

			$("#dashboard_blocks_table tbody").empty().append(rows);
			NRS.dataLoadFinished($("#dashboard_blocks_table"));
		}
	}

	NRS.handleNewBlocks = function(response) {
		if (NRS.downloadingBlockchain) {
			//new round started...
			if (NRS.temp.blocks.length == 0 && NRS.state.lastBlock != response.id) {
				return;
			}
		}

		//we have all blocks 	
		if (response.height - 1 == NRS.lastBlockHeight || NRS.temp.blocks.length == 99) {
			var newBlocks = [];

			//there was only 1 new block (response)
			if (NRS.temp.blocks.length == 0) {
				//remove oldest block, add newest block
				NRS.blocks.unshift(response);
				newBlocks.push(response);
			} else {
				NRS.temp.blocks.push(response);
				//remove oldest blocks, add newest blocks
				[].unshift.apply(NRS.blocks, NRS.temp.blocks);
				newBlocks = NRS.temp.blocks;
				NRS.temp.blocks = [];
			}

			if (NRS.blocks.length > 100) {
				NRS.blocks = NRS.blocks.slice(0, 100);
			}

			//set new last block height
			NRS.lastBlockHeight = NRS.blocks[0].height;

			NRS.useNQT = (NRS.isTestNet || NRS.lastBlockHeight >= 150000);

			NRS.incoming.updateDashboardBlocks(newBlocks);
		} else {
			NRS.temp.blocks.push(response);
			NRS.getBlock(response.previousBlock, NRS.handleNewBlocks);
		}
	}

	//we always update the dashboard page..
	NRS.incoming.updateDashboardBlocks = function(newBlocks) {
		var newBlockCount = newBlocks.length;

		if (newBlockCount > 10) {
			newBlocks = newBlocks.slice(0, 10);
			newBlockCount = newBlocks.length;
		}

		if (NRS.downloadingBlockchain) {
			if (NRS.state && NRS.state.time - NRS.blocks[0].timestamp < 60 * 60 * 30) {
				NRS.downloadingBlockchain = false;
				$("#downloading_blockchain, #nrs_update_explanation_blockchain_sync").hide();
				$("#show_console").show();
				$.growl("The block chain is now up to date.", {
					"type": "success"
				});
				NRS.checkAliasVersions();
			} else {
				NRS.updateBlockchainDownloadProgress();
			}
		}

		var rows = "";

		for (var i = 0; i < newBlockCount; i++) {
			var block = newBlocks[i];

			if (NRS.useNQT) {
				block.totalAmount = new BigInteger(block.totalAmountNQT);
				block.totalFee = new BigInteger(block.totalFeeNQT);
			}

			rows += "<tr><td>" + (block.numberOfTransactions > 0 ? "<a href='#' data-block='" + String(block.height).escapeHTML() + "' class='block' style='font-weight:bold'>" + String(block.height).escapeHTML() + "</a>" : String(block.height).escapeHTML()) + "</td><td>" + NRS.formatTimestamp(block.timestamp) + "</td><td>" + NRS.formatAmount(block.totalAmount) + " + " + NRS.formatAmount(block.totalFee) + "</td><td>" + NRS.formatAmount(block.numberOfTransactions) + "</td></tr>";
		}

		if (newBlockCount == 1) {
			$("#dashboard_blocks_table tbody tr:last").remove();
		} else if (newBlockCount == 10) {
			$("#dashboard_blocks_table tbody").empty();
		} else {
			$("#dashboard_blocks_table tbody tr").slice(10 - newBlockCount).remove();
		}

		$("#dashboard_blocks_table tbody").prepend(rows);

		//update number of confirmations... perhaps we should also update it in tne NRS.transactions array
		$("#dashboard_transactions_table tr.confirmed td.confirmations").each(function() {
			if ($(this).data("incoming")) {
				$(this).removeData("incoming");
				return true;
			}

			var confirmations = parseInt($(this).data("confirmations"), 10);

			if (confirmations <= 10) {
				var nrConfirmations = confirmations + newBlocks.length;

				$(this).data("confirmations", nrConfirmations);

				if (nrConfirmations > 10) {
					nrConfirmations = '10+';
				}
				$(this).html(nrConfirmations);
			}
		});
	}

	NRS.pages.blocks = function() {
		NRS.pageLoading();

		$("#forged_blocks_warning").hide();

		if (NRS.blocksPageType == "forged_blocks") {
			$("#forged_fees_total_box, #forged_blocks_total_box").show();
			$("#blocks_transactions_per_hour_box, #blocks_generation_time_box").hide();

			NRS.sendRequest("getAccountBlockIds+", {
				"account": NRS.account,
				"timestamp": 0
			}, function(response) {
				if (response.blockIds && response.blockIds.length) {
					var blocks = [];
					var nr_blocks = 0;

					var blockIds = response.blockIds.reverse().slice(0, 100);

					if (response.blockIds.length > 100) {
						$("#blocks_page_forged_warning").show();
					}

					for (var i = 0; i < blockIds.length; i++) {
						NRS.sendRequest("getBlock+", {
							"block": blockIds[i],
							"_extra": {
								"nr": i
							}
						}, function(block, input) {
							if (NRS.currentPage != "blocks") {
								blocks = {};
								return;
							}

							blocks[input["_extra"].nr] = block;
							nr_blocks++;

							if (nr_blocks == blockIds.length) {
								NRS.blocksPageLoaded(blocks);
							}
						});

						if (NRS.currentPage != "blocks") {
							blocks = {};
							return;
						}
					}
				} else {
					NRS.blocksPageLoaded({});
				}
			});
		} else {
			$("#forged_fees_total_box, #forged_blocks_total_box").hide();
			$("#blocks_transactions_per_hour_box, #blocks_generation_time_box").show();

			if (NRS.blocks.length < 100) {
				if (NRS.downloadingBlockchain) {
					NRS.blocksPageLoaded(NRS.blocks);
				} else {
					var previousBlock = NRS.blocks[NRS.blocks.length - 1].previousBlock;
					//if previous block is undefined, dont try add it
					if (typeof previousBlock !== "undefined")
						NRS.getBlock(previousBlock, NRS.finish100Blocks);
				}
			} else {
				NRS.blocksPageLoaded(NRS.blocks);
			}
		}
	}

	NRS.finish100Blocks = function(response) {
		NRS.blocks.push(response);
		if (NRS.blocks.length < 100 && typeof response.previousBlock !== "undefined") {
			NRS.getBlock(response.previousBlock, NRS.finish100Blocks);
		} else {
			NRS.blocksPageLoaded(NRS.blocks);
		}
	}

	NRS.blocksPageLoaded = function(blocks) {
		var rows = "";
		var total_amount = 0;
		var total_fees = 0;
		var total_transactions = 0;

		if (NRS.useNQT) {
			total_fees = new BigInteger();
			total_amount = new BigInteger();
		}

		for (var i = 0; i < blocks.length; i++) {
			var block = blocks[i];

			if (NRS.useNQT) {
				block.totalAmount = new BigInteger(block.totalAmountNQT);
				block.totalFee = new BigInteger(block.totalFeeNQT);

				total_amount = total_amount.add(new BigInteger(block.totalAmountNQT));
				total_fees = total_fees.add(new BigInteger(block.totalFeeNQT));
			} else {
				total_amount += block.totalAmount;
				total_fees += block.totalFee;
			}

			total_transactions += block.numberOfTransactions;

			var account = String(block.generator).escapeHTML();

			rows += "<tr><td>" + (block.numberOfTransactions > 0 ? "<a href='#' data-block='" + String(block.height).escapeHTML() + "' class='block' style='font-weight:bold'>" + String(block.height).escapeHTML() + "</a>" : String(block.height).escapeHTML()) + "</td><td>" + NRS.formatTimestamp(block.timestamp) + "</td><td>" + NRS.formatAmount(block.totalAmount) + "</td><td>" + NRS.formatAmount(block.totalFee) + "</td><td>" + NRS.formatAmount(block.numberOfTransactions) + "</td><td>" + (account != NRS.genesis ? "<a href='#' data-user='" + account + "' class='user_info'>" + NRS.getAccountTitle(account) + "</a>" : "Genesis") + "</td><td>" + NRS.formatVolume(block.payloadLength) + "</td><td>" + Math.round(block.baseTarget / 153722867 * 100).pad(4) + " %</td></tr>";
		}

		var startingTime = NRS.blocks[NRS.blocks.length - 1].timestamp;
		var endingTime = NRS.blocks[0].timestamp;
		var time = endingTime - startingTime;

		$("#blocks_table tbody").empty().append(rows);
		NRS.dataLoadFinished($("#blocks_table"));

		if (NRS.useNQT) {
			var divider = new BigInteger((100000000 * blocks.length).toString());

			console.log("mod = " + divider.toString());

			var fee_fractional = total_fees.mod(divider);

			console.log("fractional = " + fee_fractional.toString());
			console.log("divide = " + total_fees.divide(divider).toString());
			/*
			100000000
			10000000000
			100000000
			*/

			total_fees = parseFloat(total_fees.divide(divider).toString() + "." + fee_fractional.toString());

			$("#blocks_average_fee").html(NRS.formatAmount(total_fees, true)).removeClass("loading_dots"); //ROUND
			$("#blocks_average_amount").html(NRS.formatAmount(total_amount)).removeClass("loading_dots"); //ROUND
		} else {
			$("#blocks_average_fee").html(NRS.formatAmount(total_fees / blocks.length, true)).removeClass("loading_dots"); //ROUND
			$("#blocks_average_amount").html(NRS.formatAmount(Math.round(total_amount / 100))).removeClass("loading_dots"); //ROUND
		}

		if (NRS.blocksPageType == "forged_blocks") {
			if (blocks.length == 100) {
				var blockCount = blocks.length + "+";
				var feeTotal = NRS.formatAmount(total_fees, false) + "+";
			} else {
				var blockCount = blocks.length;
				var feeTotal = NRS.formatAmount(total_fees, false);
			}

			$("#forged_blocks_total").html(blockCount).removeClass("loading_dots");
			$("#forged_fees_total").html(feeTotal).removeClass("loading_dots");
		} else {
			$("#blocks_transactions_per_hour").html(Math.round(total_transactions / (time / 60) * 60)).removeClass("loading_dots");
			$("#blocks_average_generation_time").html(Math.round(time / 100) + "s").removeClass("loading_dots");
		}

		NRS.pageLoaded();
	}

	$("#blocks_page_type li a").click(function(e) {
		e.preventDefault();

		var type = $(this).data("type");

		if (type) {
			NRS.blocksPageType = type;
		} else {
			NRS.blocksPageType = null;
		}

		$(this).parents(".btn-group").find(".text").text($(this).text());

		NRS.pages.blocks();
	});


	return NRS;
}(NRS || {}, jQuery));