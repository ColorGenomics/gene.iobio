function BookmarkCard() {
	this.bookmarkedVariants = {};
	this.bookmarkedGenes = {};
}

BookmarkCard.prototype.init = function() {
	var me = this;
	// Stop event propogation to get genes dropdown
	// so that clicks in text area for copy/paste
	// don't cause dropdown to close
	$('#import-bookmarks-dropdown ul li#copy-paste-li').on('click', function(event){
	    //The event won't be propagated to the document NODE and 
	    // therefore events delegated to document won't be fired
	    event.stopPropagation();
	});
	// Enter in copy/paste textarea should function as submit
	$('#import-bookmarks-dropdown ul li#copy-paste-li').keyup(function(event){

		if((event.which== 13) && ($(event.target)[0]== $("textarea#bookmarks-to-import")[0])) {
			event.stopPropagation();
			me.importBookmarks();
		}
	});	
	// Detect when get genes dropdown opens so that
	// we can prime the textarea with the genes already
	// selected
	$('#import-bookmarks-dropdown').click(function () {
	    if($(this).hasClass('open')) {
	        // dropdown just closed
	    } else {
	    	// dropdown will open
	    	me.initImportBookmarks();
	    	setTimeout(function() {
			  $('#bookmarks-to-import').focus();
			}, 0);
	    	
	    }
	});
}
BookmarkCard.prototype.initImportBookmarks = function() {

}

BookmarkCard.prototype.importBookmarks = function() {
	var me = this;

	//chrom	start	end	ref	alt	gene
	var bookmarksString = $('#bookmarks-to-import').val();
	// trim newline at very end
	bookmarksString = bookmarksString.replace(/\s*$/, "");

	
	me.bookmarkedVariants = {};
	var recs = bookmarksString.split("\n");
	recs.forEach( function(rec) {
		var fields = rec.split("\t");

		if (fields.length >= 6) {
			var chrom    = fields[0];
			var start    = +fields[1];
			var end      = +fields[2];
			var ref      = fields[3];
			var alt      = fields[4];
			var geneName = fields[5];

			
			var key = me.getBookmarkKey(geneName, chrom, start, ref, alt);
			if (me.bookmarkedVariants[key] == null) {
				me.bookmarkedVariants[key] = {isProxy: true, geneName: gene, chrom: chrom, start: +start, ref: ref, alt: alt};
			}

		}
	});

	showSidebar("Bookmarks");
	me.refreshBookmarkList();

	// Add all of the genes to the gene list so that gene badges are created.
	var genesBuffer = "";
	for (var geneName in me.bookmarkedGenes) {
		if (genesBuffer.length > 0) {
			genesBuffer += ",";
		}
		genesBuffer += geneName;
	}			
	$('#genes-to-copy').val(genesBuffer);			
	copyPasteGenes(genesBuffer);			



	$('#import-bookmarks-dropdown .btn-group').removeClass('open');	

}

BookmarkCard.prototype.reviseCoord = function(bookmarkEntry, gene) {
	var me = this;
	var revisedBookmarkEntry = $().extend(bookmarkEntry);

	// TODO:  Figure out coordinate space for GEMINI
	revisedBookmarkEntry.start++;

	// TODO: If gene is reverse strand, change ref alt to compliment
	if (gene.strand == "-") {
		//revisedBookmarkEntry.alt = me.reverseBases(bookmarkEntry.alt);
		//revisedBookmarkEntry.ref = me.reverseBases(bookmarkEntry.ref);
	}

	// TODO:  Normalize since variants are normalized

	return revisedBookmarkEntry;
}

BookmarkCard.prototype.reverseBases = function(bases) {
	var reversedBases = "";
	for (var i = 0; i < bases.length; i++) {
    	var base = bases.charAt(i);
    	var rb = null;
    	if (base == 'A') {
    		rb = 'T';
    	} else if (base == 'T') {
    		rb = 'A';
    	} else if (base == 'C') {
    		rb = 'G';
    	} else if (base == 'G') {
    		rb = 'C';
    	}
    	reversedBases += rb;
    }
    return reversedBases;
}

BookmarkCard.prototype.bookmarkVariant = function(variant) {
	var me = this;
	if (variant) {		

		var key = this.getBookmarkKey(gene.gene_name,  gene.chr, variant.start, variant.ref, variant.alt);
		if (this.bookmarkedVariants[key] == null) {
			this.bookmarkedVariants[key] = variant;
			getProbandVariantCard().unpin();
			getProbandVariantCard().addBookmarkFlag(variant, me.compressKey(key), true);			
		}
	}
}

BookmarkCard.prototype.getBookmarkKey = function(geneName, chrom, start, ref, alt) {
	return geneName + ": " 
         + chrom + " " + start  
         + " " + ref + "->" + alt;         
}

BookmarkCard.prototype.compressKey = function(bookmarkKey) {
	bookmarkKey = bookmarkKey.split(": ").join("-");
	bookmarkKey = bookmarkKey.split("->").join("-");
	bookmarkKey = bookmarkKey.split(" ").join("-");
	bookmarkKey = bookmarkKey.split(".").join("-");
	return bookmarkKey;
}

BookmarkCard.prototype.determineVariantBookmarks = function(vcfData, geneObject) {
	var me = this;
	if (vcfData && vcfData.features) {
		var bookmarkKeys = me.bookmarkedGenes[geneObject.gene_name];
		if (bookmarkKeys && bookmarkKeys.length > 0) {
			bookmarkKeys.forEach( function(bookmarkKey) {
				var bookmarkEntry = me.bookmarkedVariants[bookmarkKey];
				var variant = me.resolveBookmarkedVariant(bookmarkKey, bookmarkEntry, geneObject);
				if (variant) {
					variant.isBookmark = 'Y';
				}
			});
		}
	}
}

BookmarkCard.prototype.flagBookmarks = function(variantCard, geneObject, variant, bookmarkKey) {
	var me = this;
	
	// Flag the bookmarked variant
	if (variant) {
		variantCard.addBookmarkFlag(variant, me.compressKey(bookmarkKey), true);
	}

	// Now that we have resolved the bookmark entries for a gene, refresh the
	// bookmark list so that the glyphs show for each resolved bookmark.
	me.refreshBookmarkList();

	
}

BookmarkCard.prototype.flagBookmarksForGene = function(variantCard, geneObject, bookmarkKeys) {
	var me = this;
	
	// Now flag all other bookmarked variants for a gene
	bookmarkKeys.forEach( function(key) {		
		var theBookmarkEntry = me.bookmarkedVariants[key];
		var theVariant = me.resolveBookmarkedVariant(key, theBookmarkEntry, geneObject);
		variantCard.addBookmarkFlag(theVariant, me.compressKey(key), false);
	});

	// Now that we have resolved the bookmark entries for a gene, refresh the
	// bookmark list so that the glyphs show for each resolved bookmark.
	me.refreshBookmarkList();

	
}

BookmarkCard.prototype.resolveBookmarkedVariant = function(key, bookmarkEntry, geneObject) {
	var me = this;

	var variant = null;
	if (bookmarkEntry.hasOwnProperty("isProxy")) {
		variant = getProbandVariantCard().getBookmarkedVariant(me.reviseCoord(bookmarkEntry, geneObject));
		if (variant) {
			me.bookmarkedVariants[key] = variant;
			bookmarkEntry = variant;									
		} 
	} else {
		variant = bookmarkEntry;
	}
	return variant;
}

BookmarkCard.prototype.sortBookmarksByGene = function() {
	var me = this;
    var tuples = [];

    for (var key in me.bookmarkedVariants) {
    	tuples.push([key, me.bookmarkedVariants[key]]);
	}

    tuples.sort(function(a, b) { 
    	var keyA = a[0];
    	var keyB = b[0];
    	var geneA = keyA.split(": ")[0];
    	var geneB = keyB.split(": ")[0];
    	
    	return geneA < geneB ? 1 : geneA > geneB ? -1 : 0;
    });

    var length = tuples.length;
    var sortedBookmarks = {};
    me.bookmarkedGenes = {};
    while (length--) {
    	var key   = tuples[length][0];
    	var value = tuples[length][1];
    	var geneName = key.split(": ")[0];
    	
    	sortedBookmarks[key] = value;

    	var keys = me.bookmarkedGenes[geneName];
    	if (keys == null) {
    		keys = [];
    	}
    	keys.push(key);
    	me.bookmarkedGenes[geneName] = keys;
    }

    me.bookmarkedVariants = sortedBookmarks;
}

BookmarkCard.prototype.getRsId = function(variant) {
	var rsId = null;
	if (variant.hasOwnProperty('vepVariationIds') && variant.vepVariationIds != null) {
		for (var key in variant.vepVariationIds) {
			if (key != 0 && key != '') {
				var tokens = key.split("&");
				tokens.forEach( function(id) {
					if (id.indexOf("rs") == 0) {
						rsId = id;
					}
				});
			}
		}			
	}
	return rsId;
}

BookmarkCard.prototype.refreshBookmarkList = function() {
	var me = this;
	var container = d3.select('#bookmark-card #bookmark-panel');
	container.selectAll('.bookmark-gene').remove();

	// Sort bookmarks by gene, then start position
	me.sortBookmarksByGene();

	container.selectAll(".bookmark-gene")
	         .data(d3.entries(this.bookmarkedGenes))
	         .enter()
	         .append("div")
	         .attr("class", "bookmark-gene")
	         .append("a")
	         .attr("class", "bookmark-gene")
	         .text(function(entry,i) {
	         	var geneName = entry.key;
	         	var entryKeys = entry.value;
	         	var parts = entryKeys[0].split(": ");
	         	var chr = parts[1].split(" ")[0];
	         	return  geneName + " " + chr;
	         })
	         .on('click', function(entry,i) {
				var geneName = entry.key;
				var bookmarkKeys = entry.value;


				if (window.gene.gene_name != geneName) {
					window.selectGene(geneName, function(variantCard) {
						if (variantCard.getRelationship() == 'proband') {
							me.flagBookmarksForGene(variantCard, window.gene, bookmarkKeys);
						}
					});
				} else {
					me.flagBookmarksForGene(getProbandVariantCard(), window.gene, bookmarkKeys);
				}
			});

	container.selectAll("div.bookmark-gene")
	         .each( function(entry, i) {
	         	var geneContainer = d3.select(this);

	         	var keys = entry.value;
	         	var bookmarkedVariantsForGene = {};
	         	keys.forEach( function(key) {
	         		bookmarkedVariantsForGene[key] = me.bookmarkedVariants[key];
	         	});

         		geneContainer.selectAll(".bookmark")
			         .data(d3.entries(bookmarkedVariantsForGene))
			         .enter()
			         .append("a")
			         .attr("class", "bookmark")
			         .on('click', function(entry,i) {
			         	var geneName = entry.key.split(": ")[0];
						var bookmarkEntry = entry.value;
						var key = entry.key;


						if (window.gene.gene_name != geneName) {
							window.selectGene(geneName, function(variantCard) {
								if (variantCard.getRelationship() == 'proband') {
									var variant = me.resolveBookmarkedVariant(key, bookmarkEntry, window.gene);
									me.flagBookmarks(variantCard, window.gene, variant, key);
								}
							});
						} else {
							var variant = me.resolveBookmarkedVariant(key, bookmarkEntry, window.gene);					
							me.flagBookmarks(getProbandVariantCard(), window.gene, variant, key);
						}
			         });
	        });
			
	


	container.selectAll(".bookmark")
	 		 .append("span")
	         .attr("class", "variant-symbols");

	 container.selectAll(".bookmark")
	 		 .append("span")
	         .attr("class", "variant-label");
	        
	container.selectAll(".bookmark span.variant-label")
	         .text(function(entry,i) {	
	         	var key = entry.key;
	         	var bookmarkEntry = entry.value;

	         	var rsId = me.getRsId(bookmarkEntry);

				// Strip off gene name and chr
				var tokens = key.split(": ")[1].split(" ");
	         	return tokens[1] + " " + tokens[2] + (rsId ? " " + rsId : "");
	         });


	container.selectAll(".bookmark .variant-symbols")
	         .each( function(entry, i) {
			    var selection = d3.select(this);
	         	var variant = entry.value;	         
	         	if (variant.impact) {
		         	for (var impact in variant.impact) {		         		
	         			var svg = selection.append("svg")
									       .attr("class", "impact-badge")
									       .attr("height", 12)
									       .attr("width", 14);
			         	var impactClazz =  'impact_' + impact.toUpperCase();
			         	matrixCard.showImpactBadge(svg, variant, impactClazz);	         		
		         	}	         		
	         	}
	         	if (variant.clinVarClinicalSignificance) {
	         		var lowestValue = 9999;
	         		var lowestClazz = null; 
	         		for (var clinvar in variant.clinVarClinicalSignificance) {
	         			if (matrixCard.clinvarMap[clinvar]) {
	         				if (matrixCard.clinvarMap[clinvar].value < lowestValue) {
	         					lowestValue = matrixCard.clinvarMap[clinvar].value;
	         					lowestClazz = matrixCard.clinvarMap[clinvar].clazz;
	         				}
	         				
	         			}
	         		}
	         		if (lowestClazz != null && lowestClazz != '') {
						var options = {width:10, height:10, transform: 'translate(0,1)', clazz: lowestClazz};
						var svg = selection.append("svg")
									       .attr("class", "clinvar-badge")
									       .attr("height", 12)
									       .attr("width", 14);
				        matrixCard.showClinVarSymbol(svg, options);	         		
         			}

	         	}
	         	if (variant.vepSIFT) {
					for (var sift in variant.vepSIFT) {
						if (matrixCard.siftMap[sift]) {
			         		var clazz = matrixCard.siftMap[sift].clazz;
			         		var badge = matrixCard.siftMap[sift].badge;
			         		if (clazz != '') {
								var options = {width:11, height:11, transform: 'translate(0,1)', clazz: clazz};
								var svg = selection.append("svg")
									        .attr("class", "sift-badge")
									        .attr("height", 12)
									        .attr("width", 14);
						        matrixCard.showSiftSymbol(svg, options);	         		
			         		}							
						}

	         		}
	         	}
	         	if (variant.vepPolyPhen) {
					for (var polyphen in variant.vepPolyPhen) {
						if (matrixCard.polyphenMap[polyphen]) {
			         		var clazz = matrixCard.polyphenMap[polyphen].clazz;
			         		var badge = matrixCard.polyphenMap[polyphen].badge;
			         		if (clazz != '') {
								var options = {width:10, height:10, transform: 'translate(0,2)', clazz: clazz};
								var svg = selection.append("svg")
									        .attr("class", "polyphen-badge")
									        .attr("height", 12)
									        .attr("width", 14);
						        matrixCard.showPolyPhenSymbol(svg, options);	         		
			         		}
						}
	         		}
	         	}
	         	if (variant.inheritance) {
	         		if (variant.inheritance == 'recessive') {
						var svg = selection.append("svg")
									        .attr("class", "inheritance-badge")
									        .attr("height", 14)
									        .attr("width", 16);
						var options = {width: 18, height: 16, transform: "translate(-1,1)"};
						matrixCard.showRecessiveSymbol(svg, options);										        
	         		} else if (variant.inheritance == 'denovo') {
						var svg = selection.append("svg")
									        .attr("class", "inheritance-badge")
									        .attr("height", 14)
									        .attr("width", 16);
						var options = {width: 18, height: 16, transform: "translate(-1,1)"};
						matrixCard.showDeNovoSymbol(svg, options);				
	         		}
	         	}
	         });

}