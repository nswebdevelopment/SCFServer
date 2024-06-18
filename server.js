const { ee, app, port } = require("./util/constants");

app.get("/api/hello", (req, res) => {
  res.json({ message: "Hello from server!" });
});

app.post("/api/getWorldCover", (req, res) => {
  // Map of land cover class values to their respective names.


  const landCoverNames = ee.Dictionary({
    10: "Trees",
    20: "Shrubland",
    30: "Grassland",
    40: "Cropland",
    50: "Built-up",
    60: "Bare / Sparse vegetation",
    70: "Snow and ice",
    80: "Permanent water bodies",
    90: "Herbaceous wetland",
    95: "Mangroves",
    100: "Moss and lichen",
  });

  const geometry = ee.Geometry.Polygon([req.body.lngLatArray], null, false);

  const clippedImage = ee.Image("ESA/WorldCover/v100/2020").clip(geometry);

  const grassland = clippedImage.eq(30);
  const cropland = clippedImage.eq(40);
  const forest = clippedImage.eq(50);

  const maskedImageGrassland = clippedImage.updateMask(grassland);
  const maskedImageCropland = clippedImage.updateMask(cropland);
  const maskedImageForest = clippedImage.updateMask(forest);

  const clippedImageLayer = clippedImage.getMap({ bands: ["Map"] });
  const clippedImageLayerGrassland = maskedImageGrassland.getMap({
    palette: ["028361"],
  });
  const clippedImageLayerCropland = maskedImageCropland.getMap({
    palette: ["444"],
  });
  const clippedImageLayerForest = maskedImageForest.getMap({
    palette: ["888"],
  });

  const areaPerClass = ee.Dictionary(
    clippedImage
      .reduceRegion({
        reducer: ee.Reducer.frequencyHistogram(),
        geometry: geometry,
        scale: 10,
        maxPixels: 1e13,
      })
      .get("Map")
  );

  var totalArea = 0;

  const areasArray = ee.List(areaPerClass.keys()).map(function (key) {
    const classKey = ee.Number.parse(key);

    const landCoverType = landCoverNames.get(classKey, 'Unknown'); // Provide 'Unknown' as a default
    const area = ee.Number(areaPerClass.get(key)).multiply(100); // Convert to regular number and multiply

    return ee.Dictionary({
      land_cover_name: landCoverType,
      area: area,
    });
  });

  const areasArrayJS = areasArray.getInfo();

  areasArrayJS.sort((a, b) => b.area - a.area);
  for (const element of areasArrayJS) {
    totalArea += element.area;
  }

  res.send({
    urlFormat: clippedImageLayer.urlFormat,
    grasslandUrlFormat: clippedImageLayerGrassland.urlFormat,
    croplandUrlFormat: clippedImageLayerCropland.urlFormat,
    forestUrlFormat: clippedImageLayerForest.urlFormat,
    totalArea: totalArea,
    areas: areasArrayJS,
  });
});




app.post("/api/getWorldCoverTypes", (req, res) => {
  // Map of land cover class values to their respective names.

  const {landCoverColors} = require("./util/landCoverColors");
  const {landCoverNames} = require("./util/constants");
 
  console.log("lngLatArray", [req.body.lngLatArray]);

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
    typeNames.set(index, landCoverNames[type]);
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







app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
