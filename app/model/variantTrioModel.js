function VariantTrioModel(probandVcfData, motherVcfData, fatherVcfData, unaffectedSibsVcfData) {
	this.probandVcfData = probandVcfData;
	this.motherVcfData = motherVcfData;
	this.fatherVcfData = fatherVcfData;
	this.unaffectedSibsVcfData = unaffectedSibsVcfData;
	this.variantCardsUnaffectedSibsTransient = [];
}


VariantTrioModel.prototype.compareVariantsToMotherFather = function(callback) {
	var me = this;

	// Clear out the inheritance, mother/father zygosity, mother/father genotype fields 
	// stored in proband variants
	me.probandVcfData.features.forEach(function(variant) {
		variant.compareMother = null;
		variant.compareFather = null;
		variant.inheritance = 'none';
		variant.fatherZygosity = null;
		variant.motherZygosity = null;
		variant.genotypeAltCountFather = null;
		variant.genotypeRefCountFather = null;
		variant.genotypeDepthFather    = null;
		variant.genotypeAltCountMother = null;
		variant.genotypeRefCountMother = null;
		variant.genotypeDepthMother    = null;

	});

	// Only continue with comparison if mother and father
	// variant cards are present
	if (me.motherVcfData == null || me.fatherVcfData == null) {
		callback(me.probandVcfData);
		return;
	} 


	// Sort the variants
	me.probandVcfData.features = me.probandVcfData.features.sort(orderVariantsByPosition);

	// Compare the proband's variants to the mother's variants
	me.promiseCompareVariants(
		me.probandVcfData,
		me.motherVcfData,
	    // This is the attribute on variant a (proband) and variant b (mother)
		// that will store whether the variant is unique or matches.
    	'compareMother',
    	// This is the attribute on the proband variant that will store the
		// mother's zygosity in the case where the variant match
		'motherZygosity',
    	// This is the callback function called every time we find the same variant
    	// in both sets. Here we take the mother variant's af and store it in the
    	// proband's variant for further sorting/display in the feature matrix.
    	function(variantA, variantB) {
    		variantA.motherZygosity = variantB.zygosity != null ? variantB.zygosity : '';
    		variantA.genotypeAltCountMother = variantB.genotypeAltCount;
		    variantA.genotypeRefCountMother = variantB.genotypeRefCount;
		    variantA.genotypeDepthMother    = variantB.genotypeDepthMother;
		}
	).then( function() {

		 // Compare the proband variants to the father's variants
		 return me.promiseCompareVariants(
		 	me.probandVcfData, 
		 	me.fatherVcfData,
	       	 // This is the attribute on variant a (proband) and variant b (father)
	        // that will store whether the variant is unique or matches.
	        'compareFather',
	        // This is the attribute on the proband variant that will store the
	        // father's zygosity in the case where the variant match
	        'fatherZygosity',
	    	// This is the callback function called every time we find the same variant
	    	// in both sets. Here we take the father variant's zygosity and store it in the
	    	// proband's variant for further sorting/display in the feature matrix.
	        function(variantA, variantB) {
	        	variantA.fatherZygosity = variantB.zygosity != null ? variantB.zygosity : '';
	        	variantA.genotypeAltCountFather = variantB.genotypeAltCount;
	        	variantA.genotypeRefCountFather = variantB.genotypeRefCount;
			    variantA.genotypeDepthFather    = variantB.genotypeDepthFather;
	        });  	

	}, function(error) {
		console.log("error occured when comparing proband variants to mother?");
	}).then( function() {
		// This is the function that is called after the proband variants have been compared
	    // to the father variant set. 
	    
		// Fill in the af level on each variant.  Use the af in the vcf if
		// present, otherwise, use the 1000g af if present, otherwise use
		// the ExAC af.
		me.probandVcfData.features.forEach(function(variant) {
			if (variant.zygosity != null && variant.zygosity.toLowerCase() == 'hom' 
				&& variant.motherZygosity != null && variant.motherZygosity.toLowerCase() == 'het' 
				&& variant.fatherZygosity != null && variant.fatherZygosity.toLowerCase() == 'het') {
				variant.inheritance = 'recessive';
			} else if (variant.compareMother == 'unique1' && variant.compareFather == 'unique1') {
				variant.inheritance = 'denovo';
			}
		});

		callback(me.probandVcfData);
	},
	function(error) {
		console.log("error occured after comparison of proband to mother and father");
		
	});

}

VariantTrioModel.prototype.promiseCompareVariants = function(vcfData, otherVcfData, compareAttribute, matchAttribute, onMatchFunction, onNoMatchFunction ) {
	var me = this;

	return new Promise( function(resolve, reject) {

		

	    var set1Label = 'unique1';
	    var set2Label = 'unique2';
	    var commonLabel = 'common';
	    var comparisonAttribute = compareAttribute;
	    if (comparisonAttribute == null) {
	      comparisonAttribute = 'consensus';
	    }

	    otherVcfData.features = otherVcfData.features.sort(orderVariantsByPosition);
		if (comparisonAttribute) {
			otherVcfData.features.forEach( function(feature) {			
				feature[comparisonAttribute] = '';
			});			
		}

		variants1 = vcfData;
		variants2 = otherVcfData;

	    variants1.count = variants1.features.length;
	    variants2.count = variants2.features.length;

	    var features1 = variants1.features;
	    var features2 = variants2.features;

	    // Flag duplicates as this will throw off comparisons
	    var ignoreDups = function(features) {
	      for (var i =0; i < features.length - 1; i++) {
	        var variant = features[i];
	        var nextVariant = features[i+1];
	        if (i == 0) {
	          variant.dup = false;
	        }
	        nextVariant.dup = false;

	        if (variant.start == nextVariant.start) {
	             var refAlt = variant.type.toLowerCase() + ' ' + variant.ref + "->" + variant.alt;
	             var nextRefAlt = nextVariant.type.toLowerCase() + ' ' + nextVariant.ref + "->" + nextVariant.alt;

	             if (refAlt == nextRefAlt) {
	                nextVariant.dup = true;
	             }
	        }
	      }
	    }
	    ignoreDups(features1);
	    ignoreDups(features2);


	    // Iterate through the variants from the first set,
	    // marking the consensus field based on whether a 
	    // matching variant from the second list is encountered.
	    var idx1 = 0;
	    var idx2 = 0;
	    while (idx1 < features1.length && idx2 < features2.length) {
	      // Bypass duplicates
	      if (features1[idx1].dup) {
	        idx1++;
	      }
	      if (features2[idx2].dup) {
	        idx2++;
	      }

	      variant1 = features1[idx1];
	      variant2 = features2[idx2];
	      
	      var refAlt1 = variant1.type.toLowerCase() + ' ' + variant1.ref + "->" + variant1.alt;
	      var refAlt2 = variant2.type.toLowerCase() + ' ' + variant2.ref + "->" + variant2.alt;

	      if (variant1.start == variant2.start) {

	        if (refAlt1 == refAlt2) {
	          variant1[comparisonAttribute] =  commonLabel;
	          variant2[comparisonAttribute] =  commonLabel;

	          if (onMatchFunction) {
	            onMatchFunction(variant1, variant2);
	          }
	          idx1++;
	          idx2++;
	        } else if (refAlt1 < refAlt2) {
	          variant1[comparisonAttribute] = set1Label;
	          if (onNoMatchFunction) {
	            onNoMatchFunction(variant1, null);
	          }
	          idx1++;
	        } else {
	          variant2[comparisonAttribute] = set2Label;
	          if (onNoMatchFunction) {
	            onNoMatchFunction(null, variant2);
	          }
	          idx2++;
	        }
	      } else if (variant1.start < variant2.start) {
	        variant1[comparisonAttribute] = set1Label;
	        if (onNoMatchFunction) {
	            onNoMatchFunction(variant1, null);
	        }
	        idx1++;
	      } else if (variant2.start < variant1.start) {
	        variant2[comparisonAttribute] = set2Label;
	        if (onNoMatchFunction) {
	            onNoMatchFunction(null, variant2);
	        }
	        idx2++;
	      }

	    }


	    // If we get to the end of one set before the other,
	    // mark the remaining as unique
	    //
	    if (idx1 < features1.length) {
	      for(x = idx1; x < features1.length; x++) {
	        var variant1 = features1[x];
	        variant1[comparisonAttribute] = set1Label;
	        if (onNoMatchFunction) {
	            onNoMatchFunction(variant1, null);
	        }
	      }
	    } 
	    if (idx2 < features2.length) {
	      for(x = idx2; x < features2.length; x++) {
	        var variant2 = features2[x];
	        variant2[comparisonAttribute] = set2Label;
	        if (onNoMatchFunction) {
	            onNoMatchFunction(null, variant2);
	        }        
	      }
	    } 


		resolve();	
	
	});


}



// TODO:  Need to load unaffected sibs vcf data (variantModel.loadVariantDataOnly) beforehand
VariantTrioModel.prototype.determineUnaffectedSibsStatus = function(unaffectedSibsVcfData, onUpdate) {
	var me = this;
	me.unaffectedSibsVcfData = unaffectedSibsVcfData;

	me.probandVcfData.features = me.probandVcfData.features.sort(orderVariantsByPosition);

	me.unaffectedSibsTransientVcfData = [];
	me.unaffectedSibsVcfData.forEach( function(vcfData) {
		me.unaffectedSibsTransientVcfData.push(vcfData);
	})

	me.nextCompareToUnaffectedSib(function() {

		me.probandVcfData.features.forEach( function(variant) {
			 variant.ua = "none";
			 if (variant.inheritance != null && variant.inheritance.toLowerCase() == 'recessive' && variant.uasibsZygosity) {
			 	 var matchesCount = 0;
			 	 var matchesHomCount = 0;
				 Object.keys(variant.uasibsZygosity).forEach( function(key) {
				 	matchesCount++;
				 	var sibZygosity = variant.uasibsZygosity[key];
				 	if (sibZygosity != null && sibZygosity.toLowerCase() == 'hom') {
					 	matchesHomCount++;
				 	}
				 });

				 if (matchesHomCount > 0 ) {
				 	variant.ua = "none";
				 } else {
				 	variant.ua = "not_recessive_in_sibs";
				 }  	 	 
			 } 
		});

		if (onUpdate) {
			onUpdate();
		}

	});

}

VariantTrioModel.prototype.nextCompareToUnaffectedSib = function(callback) {
	var me = this;
	if (me.unaffectedSibsTransientVcfData.length > 0) {
		var vcfData = me.unaffectedSibsTransientVcfData.shift();

		me.promiseCompareToUnaffectedSib(vcfData).then( function() {
			me.nextCompareToUnaffectedSib(callback);
		});		
	} else {
		callback();
	} 
}


VariantTrioModel.prototype.promiseCompareToUnaffectedSib = function(unaffectedSibVcfData) {
	var me = this;
	
	return new Promise( function(resolve, reject) {

		me.probandVcfData.features.forEach(function(variant) {
			if (variant.uasibsZygosity) {
				variant.uasibsZygosity[unaffectedSibVcfData.name] = "none";		
			} else {
				variant.uasibsZygosity = {};
			}
		});
				
		var idx = 0;
		me.promiseCompareVariants(
			me.probandVcfData,	
			unaffectedSibVcfData,		
			// This is the attribute on variant a (proband) and variant b (unaffected sib)
	        // that will store whether the variant is unique or matches.
	        null,
	        // This is the attribute on the proband variant that will store the
	        // zygosity in the case where the variant match
	        null,
	    	// This is the callback function called every time we find the same variant
	    	// in both sets. Here we take the father variant's zygosity and store it in the
	    	// proband's variant for further sorting/display in the feature matrix.
	        function(variantA, variantB) {
	        	variantA.uasibsZygosity[unaffectedSibVcfData.name] = variantB.zygosity;
	        },
	        function(variantA, variantB) {
	        	if (variantA) {
	        		variantA.uasibsZygosity[unaffectedSibVcfData.name] = "none";
	        	}
	        }
	     ).then( function() {
	     	resolve();
	     });

	});




}




