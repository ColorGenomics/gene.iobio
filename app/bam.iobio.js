
// extending Thomas Down's original BAM js work

var Bam = Class.extend({

   init: function(bamUri, options) {
      this.bamUri = bamUri;
      this.options = options; // *** add options mapper ***
      // test if file or url
      if (typeof(this.bamUri) == "object") {
         this.sourceType = "file";
         this.bamFile = this.bamUri;
         this.baiFile = this.options.bai;
         this.makeBamBlob();
      } else  {
         this.sourceType = "url";
         this.bamFile = null;
         this.baiFile = null;
      }
      this.promises = [];

      this.errorMessageMap =  {
        "samtools Error: stderr - Could not load .bai":  "Unable to load the index (.bai) file, which has to exist in same directory and be given the same name as the .bam with the file extension of .bam.bai.",
        "samtools Error: stderr - [E::hts_open] fail to open file": "Unable to access the file.  ",
        "samtools Error: stderr - [E::hts_open_format] fail to open file": "Unable to access the file.  ",
        "samtools Error: stderr - [M::test_and_fetch] downloading file": "Invalid index or compressed vcf.  Try re-creating the bam and index file."
      }

      var ignoreMessageMap =  {
        //"tabix Error: stderr - [M::test_and_fetch] downloading file": {ignore: true}
      }


      return this;
   },

   clear: function() {
    this.bamFile = null;
    this.baiFile = null;
    this.bamUri = null;
   },

   makeBamBlob: function() {
     var me = this;
     this.bamBlob = new BlobFetchable(this.bamFile);
     this.baiBlob = new BlobFetchable(this.baiFile); // *** add if statement if here ***         
     makeBam(this.bamBlob, this.baiBlob, function(bam) {
        me.setHeader(bam.header);
        me.provide(bam);
     });
   }, 

  checkBamUrl: function(url, callback) {
    var me = this;

    var rexp = /^(?:ftp|http|https):\/\/(?:(?:[^.]+|[^\/]+)(?:\.|\/))*?(bam)$/;
    var parts = rexp.exec(url);
    // first element has entire url, second has the bam extension.
    var extension = parts && parts.length == 2  ? parts[1] : null;
    if (extension == null) {
      callback(false, "Please specify a URL to a compressed, indexed alignment file with the file extension bam");
    } else {
      var success = null;
      var cmd = new iobio.cmd(
          IOBIO.samtools,
          ['view', '-H', url]
      );

      cmd.on('data', function(data) {
        if (data != undefined) {
          success = true;
        }
      });

      cmd.on('end', function() {
        if (success == null) {
          success = true;
        }
        if (success) {
          callback(success);
        }
      });

      cmd.on('error', function(error) {
        if (me.ignoreErrorMessage(error)) {
          success = true;
          callback(success)
        } else {
          if (success == null) {
            success = false;
            me.bamUri = url;
            callback(success, me.translateErrorMessage(error));
          }
        }

      });

      cmd.run();      
      
    }
  },



  ignoreErrorMessage: function(error) {
    var me = this;
    var ignore = false;
    for (err in me.ignoreMessageMap) {
      if (error.indexOf(err) == 0) {
        ignore = me.ignoreMessageMap[err].ignore;
      }
    }
    return ignore;

  },

  translateErrorMessage:  function(error) {
    var me = this;
    var message = null;
    for (err in me.errorMessageMap) {
      if (message == null && error.indexOf(err) == 0) {
        message = me.errorMessageMap[err];
      }
    }
    return message ? message : error;
  },

  openBamFile: function(event, callback) {
    var me = this;


    if (event.target.files.length != 2) {
       callback(false, 'must select 2 files, both a .bam and .bam.bai file');
       return;
    }

    if (endsWith(event.target.files[0].name, ".sam") ||
        endsWith(event.target.files[1].name, ".sam")) {
      callback(false, 'You must select a bam file, not a sam file');
      return;
    }

    var fileType0 = /([^.]*)\.(bam(\.bai)?)$/.exec(event.target.files[0].name);
    var fileType1 = /([^.]*)\.(bam(\.bai)?)$/.exec(event.target.files[1].name);

    var fileExt0 = fileType0 && fileType0.length > 1 ? fileType0[2] : null;
    var fileExt1 = fileType1 && fileType1.length > 1 ? fileType1[2] : null;

    var rootFileName0 = fileType0 && fileType0.length > 1 ? fileType0[1] : null;
    var rootFileName1 = fileType1 && fileType1.length > 1 ? fileType1[1] : null;


    if (fileType0 == null || fileType0.length < 3 || fileType1 == null || fileType1.length <  3) {
      callback(false, 'You must select BOTH  a compressed bam file  and an index (.bai)  file');
      return;
    }


    if (fileExt0 == 'bam' && fileExt1 == 'bam.bai') {
      if (rootFileName0 != rootFileName1) {
        callback(false, 'The index (.bam.bai) file must be named ' +  rootFileName0 + ".bam.bai");
        return;
      } else {
        me.bamFile   = event.target.files[0];
        me.baiFile = event.target.files[1];

      }
    } else if (fileExt1 == 'bam' && fileExt0 == 'bam.bai') {
      if (rootFileName0 != rootFileName1) {
        callback(false, 'The index (.bam.bai) file must be named ' +  rootFileName1 + ".bam.bai");
        return;
      } else {
        me.bamFile   = event.target.files[1];
        me.baiFile = event.target.files[0];
      }
    } else {
      callback(false, 'You must select BOTH  a bam and an index (.bam.bai)  file');
      return;
    }
    me.sourceType = "file";
    me.makeBamBlob();
    callback(true);
    return;
  },




   fetch: function( name, start, end, callback, options ) {
      var me = this;
      // handle bam has been created yet
      if(this.bam == undefined) // **** TEST FOR BAD BAM ***
         this.promise(function() { me.fetch( name, start, end, callback, options ); });
      else
         this.bam.fetch( name, start, end, callback, options );
   },

   promise: function( callback ) {
      this.promises.push( callback );
   },

   provide: function(bam) {
      this.bam = bam;
      while( this.promises.length != 0 )
         this.promises.shift()();
   },

   _makeid: function() {
      // make unique string id;
       var text = "";
       var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

       for( var i=0; i < 5; i++ )
           text += possible.charAt(Math.floor(Math.random() * possible.length));

       return text;
   },

   _getBamUrl: function(name, start, end) {
      return this._getBamRegionsUrl([ {'name':name,'start':start,'end':end} ]);
   },

   _getBamRegionsUrl: function(regions, golocal) {
      var samtools = this.sourceType == "url" ? IOBIO.samtoolsServiceOnDemand : IOBIO.samtoolsService;
      if ( this.sourceType == "url") {
         var regionStr = "";
         regions.forEach(function(region) { regionStr += " " + region.name + ":" + region.start + "-" + region.end });
         var url = samtools + "?cmd= view -b " + this.bamUri + regionStr + "&protocol=http&encoding=binary";
      } else {

        var url = samtools + "?protocol=websocket&encoding=binary&cmd=view -S -b " + encodeURIComponent("http://client");


      }
      return encodeURI(url);
   },

    _getBamPileupUrl: function(region, golocal) {
      var samtools = this.sourceType == "url" ? IOBIO.samtoolsServiceOnDemand : IOBIO.samtoolsService;
      if ( this.sourceType == "url") {
         var bamRegionsUrl = this._getBamRegionsUrl([region], golocal);
         var url = samtools + "?protocol=http&encoding=utf8&cmd= mpileup " + encodeURIComponent(bamRegionsUrl);
      } else {

        var url = samtools + "?protocol=websocket&encoding=utf8&cmd= mpileup " + encodeURIComponent("http://client");

      }
      return encodeURI(url);
   },



   getReferencesWithReads: function(callback) {
      var refs = [];
      var me = this;
      if (this.sourceType == 'url') {

      } else {
         this.getHeader(function(header) {
            for (var i=0; i < header.sq.length; i++) {
               if ( me.bam.indices[me.bam.chrToIndex[header.sq[i].name]] != undefined )
                  refs.push( header.sq[i] );
            }
            callback(refs);
         })
      }
   },

   // *** bamtools functionality ***

   convert: function(format, name, start, end, callback, options) {
      // Converts between BAM and a number of other formats
      if (!format || !name || !start || !end)
         return "Error: must supply format, sequenceid, start nucleotide and end nucleotide"

      if (format.toLowerCase() != "sam")
         return "Error: format + " + options.format + " is not supported"
      var me = this;
      this.fetch(name, start, end, function(data,e) {
         if(options && options.noHeader)
            callback(data, e);
         else {
            me.getHeader(function(h) {
               callback(h.toStr + data, e);
            })
         }
      }, { 'format': format })
   },


   getHeader: function(callback) {
      var me = this;
      if (me.header) {
         callback(me.header);        
      }
      else if (me.sourceType == 'file') {
        console.log('Error: header not set for local bam file');
        callback(null);
      } else {

        var success = null;
        var cmd = new iobio.cmd(
            IOBIO.samtools,
            ['view', '-H', me.bamUri]
        );
        var rawHeader = "";
        cmd.on('data', function(data) {
          if (data != undefined) {
            rawHeader += data;
          }
        });

        cmd.on('end', function() {
          me.setHeader(rawHeader);
          callback( me.header);
        });

        cmd.on('error', function(error) {
          console.log(error);
        });
        cmd.run();    

        
      }
   },



   setHeader: function(headerStr) {
      var header = { sq:[], toStr : headerStr };
      var lines = headerStr.split("\n");
      for ( var i=0; i<lines.length > 0; i++) {
         var fields = lines[i].split("\t");
         if (fields[0] == "@SQ") {
            var fHash = {};
            fields.forEach(function(field) {
              var values = field.split(':');
              fHash[ values[0] ] = values[1]
            })
            header.sq.push({name:fHash["SN"], end:1+parseInt(fHash["LN"])});
         }
      }
      this.header = header;
   },



   transformRefName: function(refName, callback) {
    var found = false;
    this.getHeader(function(header) {
      header.sq.forEach(function(seq) {
        if (seq.name == refName || seq.name.split('chr')[1] == refName || seq.name == refName.split('chr')[1]) {
          found = true;
          callback(seq.name);
        }
      })
      if (!found) callback(refName); // not found
    })
   },


   /*
   *  This method will return coverage as point data.  It takes the reference name along
   *  with the region start and end.  Optionally, the caller can provide an array of
   *  region objects to get the coverage at exact positions.  Also, this method takes an
   *  optional argument of maxPoints that will specify how many data points should be returned
   *  for the region.  If not specified, all data points are returned.  The callback method
   *  will send back to arrays; one for the coverage points, reduced down to the maxPoints, and
   *  the second for coverage of specific positions.  The latter can then be matched to vcf records
   *  , for example, to obtain the coverage for each variant.
   */
   getCoverageForRegion: function(refName, regionStart, regionEnd, regions, maxPoints, callback, callbackError) {
      var me = this;
      this.transformRefName(refName, function(trRefName){
        var samtools = me.sourceType == "url" ?  IOBIO.samtoolsOnDemand : IOBIO.samtools;

        var regionsArg = "";
        regions.forEach( function(region) {
          region.name = trRefName;
          if (region.name && region.start && region.end) {
            if (regionsArg.length == 0) {
              regionsArg += " -p ";
            } else {
              regionsArg += ",";
            }
            regionsArg += region.name + ":" + region.start +  ":" + region.end;
          }
        });
        var maxPointsArg = "";
        if (maxPoints) {
          maxPointsArg = " -m " + maxPoints;
        } else {
          maxPointsArg = " -m 0"
        }
        var spanningRegionArg = " -r " + trRefName + ":" + regionStart + ":" + regionEnd;
        var regionArg =  trRefName + ":" + regionStart + "-" + regionEnd;

        var cmd = null;
        // When file served remotely, first run samtools view, then run samtools mpileup.
        // When bam file is read as a local file, just stream sam records for region to
        // samtools mpileup.
        if (me.sourceType == "url") {
          cmd = new iobio.cmd(samtools, ['view', '-b',       me.bamUri, regionArg],
            {
              'urlparams': {'encoding':'binary'}
            });
          cmd = cmd.pipe(samtools, ["mpileup", "-"]);
        } else {

          function writeSamFile (stream) {
             stream.write(me.header.toStr);
             me.convert('sam', trRefName, regionStart, regionEnd, function(data,e) {
                stream.write(data);
                stream.end();
             }, {noHeader:true});
          }

          cmd = new iobio.cmd(samtools, ['mpileup',  writeSamFile ],
            {
              'urlparams': {'encoding':'utf8'}
            });

        }

        // After running samtools mpileup, run coverage service to summarize point data.
        cmd = cmd.pipe(IOBIO.coverage, [maxPointsArg, spanningRegionArg, regionsArg]);

        var samData = "";
        cmd.on('data', function(data) {
          if (data == undefined) {
            return;
          }

          samData += data;
        });

        cmd.on('end', function() {

          if (samData != "") {
            var coverage = null;
            var coverageForPoints = [];
            var coverageForRegion = [];
            var lines = samData.split('\n');
            lines.forEach(function(line) {
              if (line.indexOf("#specific_points") == 0) {
                coverage = coverageForPoints;
              } else if (line.indexOf("#reduced_points") == 0 ) {
                coverage = coverageForRegion;
              } else {
                var fields = line.split('\t');
                var pos = -1;
                var depth = -1;
                if (fields[0] != null && fields[0] != '') {
                  var pos   = +fields[0];
                }
                if (fields[1] != null && fields[1] != '') {
                  var depth = +fields[1];
                }
                if (coverage){
                  if (pos > -1  && depth > -1) {
                    coverage.push([pos, depth]);
                  }
                }
              }
            });
          }
          callback(coverageForRegion, coverageForPoints);
        });

        cmd.on('error', function(error) {
          console.log(error);

        });

        cmd.run();


      });

   },


   getFreebayesVariants: function(refName, regionStart, regionEnd, regionStrand, isRefSeq, callback) {

    var me = this;
    this.transformRefName(refName, function(trRefName){

      var samtools = me.sourceType == "url" ? IOBIO.samtoolsOnDemand : IOBIO.samtools;
      var refFile = null;
      // TODO:  This is a workaround until we introduce a genome build dropdown.  For
      // now, we support Grch37 and hg19.  For now, this lame code simply looks at
      // the reference name to determine if the references should be hg19 (starts with 'chr;)
      // or Crch37 (just the number, no 'chr' prefix).  Based on the reference,
      // we point freebayes to a particular directory for the reference files.
      if (trRefName.indexOf('chr') == 0) {
        refFile = "./data/references_hg19/" + trRefName + ".fa";
      } else {
        refFile = "./data/references/hs_ref_chr" + trRefName + ".fa";
      }
      var regionArg =  trRefName + ":" + regionStart + "-" + regionEnd;

      var cmd = null;
      // When file served remotely, first run samtools view, then run samtools mpileup.
      // When bam file is read as a local file, just stream sam records for region to
      // samtools mpileup.
      if (me.sourceType == "url") {
        //cmd = new iobio.cmd("nv-green.IOBIO.io/samtools/", ['view', '-b', me.bamUri, regionArg],
        cmd = new iobio.cmd(samtools, ['view', '-b', me.bamUri, regionArg],
         {
            'urlparams': {'encoding':'binary'}
          });
        cmd = cmd.pipe(IOBIO.freebayes, [ '--stdin', '-f', refFile]);
      } else {

        var writeStream = function(stream) {
           stream.write(me.header.toStr);
           me.convert('sam', trRefName, regionStart, regionEnd, function(data,e) {
              stream.write(data);
              stream.end();
           }, {noHeader:true});
        }
        
        cmd = new iobio.cmd(samtools, ['view -b',  writeStream ],
            {
              'urlparams': {'encoding':'binary'}
            });
        cmd = cmd.pipe(IOBIO.freebayes, [ '--stdin', '-f', refFile]);
         
      }


      cmd = cmd.pipe(IOBIO.vt, ['normalize', '-r', refFile, '-']);
      cmd = cmd.pipe(IOBIO.vcflib, ['vcffilter', '-f', '\"QUAL > 1\"']);


      //
      // NEW CODE - Annotate variants that were just called from freebayes
      //
     
      // bcftools to append header rec for contig
      var contigStr = "";
      getHumanRefNames(refName).split(" ").forEach(function(ref) {
          contigStr += "##contig=<ID=" + ref + ">\n";
      })
      var contigNameFile = new Blob([contigStr])
      //cmd = cmd.pipe(IOBIO.bcftools, ['annotate', '-h', contigNameFile])

      // Get Allele Frequencies from 1000G and ExAC
      //cmd = cmd.pipe(IOBIO.af)

      // VEP to annotate
      var vepArgs = "";
      if (isRefSeq) {
        vepArgs = " --refseq "
      }
      //cmd = cmd.pipe(IOBIO.vep, [vepArgs]);


      
      var variantData = "";
      cmd.on('data', function(data) {
          if (data == undefined) {
            return;
          }

          variantData += data;
      });

      cmd.on('end', function() {
        callback(variantData);
      });

      cmd.on('error', function(error) {
        console.log(error);
      });

      cmd.run();

    });

   },





   reducePoints: function(data, factor, xvalue, yvalue) {
      if (factor <= 1 ) {
        return data;
      }
      var i, j, results = [], sum = 0, length = data.length, avgWindow;

      if (!factor || factor <= 0) {
        factor = 1;
      }

      // Create a sliding window of averages
      for(i = 0; i < length; i+= factor) {
        // Slice from i to factor
        avgWindow = data.slice(i, i+factor);
        var min = 999999;
        var max = 0;
        for (j = 0; j < avgWindow.length; j++) {
            var y = yvalue(avgWindow[j]);
            sum += y != null ? d3.round(y) : 0;

            if (y > max) {
              max = y;
            }
            if (y < min) {
              min = y;
            }
        }
        var average = d3.round(sum / factor);
        results.push([xvalue(data[i]), average])
        sum = 0;
      }
      return results;
   }

 




});