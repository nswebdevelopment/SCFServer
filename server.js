const { ee, app, port, privateKey } = require("./util/constants");

//initialize the Earth Engine client library before each request
app.use((req, res, next) => {
  ee.data.authenticateViaPrivateKey(privateKey, () => {
    ee.initialize(null, null, () => {
      console.log("Earth Engine client library initialized.");
      next();
    }, (err) => {
      console.error('Initialization failed: ', err);
      res.status(500).send('Earth Engine client library initialization failed.');
    });
  });
});

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.post("/api/getWorldCoverTypes", (req, res) => {
  // Map of land cover class values to their respective names.

  const {landCoverColors} = require("./util/landCoverColors");
  const {landCoverNames} = require("./util/constants");
 
  console.log("lngLatArray", req.body);

  const geometry = ee.Geometry.Polygon([req.body.lngLatArray], null, false);
  const geometryArea = geometry.area(1).getInfo();
  

  const types = req.body.types;//[30,40,50]
  
  const worldCover = ee.Image("ESA/WorldCover/v100/2020");


  let combinedMask = ee.Image.constant(0); // Initialize with an image of zeros
  const palette = [];
  const newTypeValues = [];
  const typeNames = new Map();


  types.forEach((type, index) => {
    // Create masks for each land cover type
    const typeMask = worldCover.eq(type);
    combinedMask = combinedMask.or(typeMask);
  
    // Use the index in your code
    newTypeValues.push(index);
    palette.push(landCoverColors[type]); // assuming colors is an array of color codes
    // typeNames.set(index, landCoverNames[type].getInfo());
    typeNames.set(index, type);
  });

    // Remap the class values to the new values
    var remappedImage = worldCover.remap(
      types,
      newTypeValues
    );
  

// Apply the mask to the image
  const filteredImage = remappedImage.updateMask(combinedMask);
  const clippedImage = filteredImage.clip(geometry);


  const areaPerClass = ee.Dictionary(
    clippedImage
      .reduceRegion({
        reducer: ee.Reducer.frequencyHistogram(),
        geometry: geometry,
        scale: 10,
        maxPixels: 1e13,
      })
      .get("remapped")
  );


  const clippedImageLayer = clippedImage.getMap({
    min: 0,
    max: palette.length - 1,
    bands: ['remapped'],
    palette: palette  // Replace with your desired colors
  });

  const areasArray = ee.List(areaPerClass.keys()).map(function (key) {
    const classKey = ee.Number.parse(key);

    const landCoverType = classKey;
    const area = ee.Number(areaPerClass.get(key)).multiply(100); // Convert to regular number and multiply

    return ee.Dictionary({
      land_cover_name: landCoverType,
      area: area,
      color: '#fff',
    });
  });


  const areasArrayJS = areasArray.getInfo();


  let totalArea = 0;
  areasArrayJS.sort((a, b) => b.area - a.area);
  for (const element of areasArrayJS) {
    const classKeyInt = parseInt(element.land_cover_name);
    element.land_cover_name = typeNames.get(classKeyInt);
    element.color = palette[classKeyInt];
    totalArea += element.area;
  }

  // console.log("totalArea", totalArea);
  // console.log("geometryArea", geometryArea);

  res.send({
    urlFormat: clippedImageLayer.urlFormat,
    grasslandUrlFormat: clippedImageLayer.urlFormat,
    croplandUrlFormat: clippedImageLayer.urlFormat,
    forestUrlFormat: clippedImageLayer.urlFormat,
    parcelArea: geometryArea,
    totalArea: totalArea,
    areas: areasArrayJS,
  });
});

app.get("/api/getSoilData", (req, res) => {

  const soilCarbon = ee.Image('projects/soilgrids-isric/soc_mean');

  // const soc_0_5cm = soilCarbon.select('soc_0-5cm_mean');
  // const soc_5_15cm = soilCarbon.select('soc_5-15cm_mean');
  // const soc_15_30cm = soilCarbon.select('soc_15-30cm_mean');
  // const soc_30_60cm = soilCarbon.select('soc_30-60cm_mean');
  // const soc_60_100cm = soilCarbon.select('soc_60-100cm_mean');
  const soc_100_200cm = soilCarbon.select('soc_100-200cm_mean');

  const visParams = {
    min: 0,
    max: 212,  // Adjusted to reflect typical SOC ranges in g/kg
    palette: ['#FFFFBE','#FFEFA7','#FFE091','#FAD27C','#D4C569','#AFB45A', '#81924A', '#607E3E', '#467D37', 
    '#367D3C',
    '#327D52', '#2C7B67', '#267570', '#1E626F', '#164C68', '#143A66', '#1B2C66', '#251E65', '#321265', '#400565'
    ]
  };


  const soc100_200cm = soc_100_200cm.getMap(visParams);

  res.send({
    soc_100_200cm: soc100_200cm.urlFormat,
  });
});


app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
