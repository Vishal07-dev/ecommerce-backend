// KŌRA editorial seed.
//
//   npm run seed
//
// 1. Uploads each source photograph (free Unsplash License images) to the
//    project's Cloudinary under `kora/`, reading back the real dimensions.
// 2. Derives detail crops from those uploads with Cloudinary transformations,
//    so a "detail" image always shows the same garment.
// 3. Upserts categories, editions (collections), products, looks and
//    site assets by name/slug/key. Running it twice changes nothing new.
// 4. Archives the five pre-existing test products (isArchived: true).
//    Nothing is deleted.

import 'dotenv/config';
import mongoose from 'mongoose';
import { cloudinary } from '../utils/cloudinary.js';
import { DB_NAME } from '../constant.js';
import { Product } from '../models/product.model.js';
import { Category } from '../models/category.model.js';
import { Collection } from '../models/collection.model.js';
import { Look } from '../models/look.model.js';
import { Asset } from '../models/asset.model.js';

// ---------------------------------------------------------------------------
// Source photographs. `id` is the Unsplash photo id; `cdn` is the base URL its
// public download link resolves to.
// ---------------------------------------------------------------------------
const PHOTOS = {
  coatIvory:    { id: 'I0IkD0IOYMM', cdn: 'photo-1638109879135-285a7b8b5924', by: 'Patrik Velich', alt: 'Man in an ivory wool overcoat over a grey roll-neck, standing in a dark studio' },
  coatOat:      { id: 'PFTjVsYUWzs', cdn: 'photo-1732842430197-0ecd55fe98ea', by: 'GlassesShop', alt: 'Man in an oat double-breasted overcoat and dark glasses on a city street' },
  coatOlive:    { id: 'hsZbpq_HCNk', cdn: 'photo-1715536369840-9e314f847d78', by: 'Gabriel Martin', alt: 'Man in an olive military long coat mid-stride through a stone alley' },
  blazer:       { id: 'tjCROIpFD0Y', cdn: 'photo-1747814896398-bdf36d11f596', by: 'Alina Matveycheva', alt: 'Woman in a long ash blazer worn as a dress, standing in a white tiled studio' },
  knitEcru:     { id: 'mU88MlEFcoU', cdn: 'photo-1574201635302-388dd92a4c3f', by: 'Valna Studio', alt: 'Ecru rib-knit crewneck pulled up over the face against a white wall' },
  knitSet:      { id: 'rz3sw-8VNCw', cdn: 'photo-1759229874914-c1ffdb3ebd0c', by: 'Manito Silk', alt: 'Woman in an oat knit sweater and matching skirt against a wood-panelled wall' },
  hoodie:       { id: '11oaSaiV65U', cdn: 'photo-1720771182580-9c16bab52681', by: 'Beau Horyza', alt: 'Man in a dark bark-brown hoodie, hand on his chest, against a dusk sky' },
  shirtYellow:  { id: 'SU_E0wkeOf4', cdn: 'photo-1633965389685-46bf705e23da', by: 'Neer Hasan', alt: 'Man in a turmeric-yellow shirt and relaxed white trousers, standing in afternoon shade' },
  nightBaggy:   { id: 'yf0d2ct9gL0', cdn: 'photo-1686687252343-061e746b4ad1', by: 'Tanya Layko', alt: 'Man mid-stride in baggy white trousers and a printed shirt under blue stage light' },
  teeSage:      { id: 'ufuk99QfQTg', cdn: 'photo-1523380677598-64d85d015339', by: 'Keagan Henman', alt: 'Sage-green crew-neck tees hanging on wooden hangers' },
  teeInkA:      { id: '_tcJW4nqVtw', cdn: 'photo-1623366302587-b38b1ddaefd9', by: 'Mostafa KordZangeneh', alt: 'Man in a black crew-neck tee, arms folded, against a pale wall' },
  teeInkB:      { id: 'VdSd8u5N5Ic', cdn: 'photo-1759346617240-b45ed956868e', by: 'Chirayu Trivedi', alt: 'Smiling man in a black tee and trousers, black-and-white portrait' },
  teeInkC:      { id: '4kDtZ_rJMS4', cdn: 'photo-1790065647534-681685463320', by: 'Adewale Shobaloju', alt: 'Man in a black tee resting his chin on his hand, black-and-white portrait' },
  teeBoneA:     { id: 'JskqEILt-ds', cdn: 'photo-1620799139834-6b8f844fbe61', by: 'Mediamodifier', alt: 'White crew-neck tee laid flat on a pale floor beside white sneakers' },
  teeBoneB:     { id: 'elbKS4DY21g', cdn: 'photo-1620799139507-2a76f79a2f4d', by: 'Mediamodifier', alt: 'White crew-neck tee laid flat next to sneakers, a book and a palm leaf' },
  teeDress:     { id: 'VLuisXRXt5I', cdn: 'photo-1667890786367-85853fa47a34', by: 'Mediamodifier', alt: 'Woman in an oversized white tee dress and a wide-brim hat against a pale backdrop' },
  knitMacro:    { id: '-ikp7hwRJ_M', cdn: 'photo-1595026525047-dfa997df8a4a', by: 'engin akyurt', alt: 'Close-up of white knit stitches running in rows' },
  wovenMacro:   { id: 'el2py0GLHkA', cdn: 'photo-1650406268594-c5d310f6fbce', by: 'engin akyurt', alt: 'Macro of a grey woven fabric' },
  fabricFlow:   { id: 'VcTDB93yiQY', cdn: 'photo-1597834793391-e5bdbeb4037a', by: 'Molly Mears', alt: 'White cotton caught mid-air against a pale backdrop' },
  rackNeutral:  { id: 'mwa_nzFpnJw', cdn: 'photo-1603400521630-9f2de124b33b', by: 'Thom Bradley', alt: 'A rail of neutral garments on wooden hangers beside a plant' },
  rackBoutique: { id: 'pkOSF1frs1g', cdn: 'photo-1750603247133-1fd1b4e4aca4', by: 'Samuel Sng', alt: 'Rails of knitwear and coats in a bare concrete boutique' },
  hangers:      { id: 'Yy4sN6QzboU', cdn: 'photo-1517502166878-35c93a0072f0', by: 'Andrej Lišakov', alt: 'Empty white hangers on a white rail' },
  brick:        { id: 'qLvhyVUE0NM', cdn: 'photo-1602231206872-fdbed9416eb6', by: 'Abhishek Donda', alt: 'Curved brick walls and arched openings in afternoon shade' },
};

// The CDN ids above that are blank are resolved at run time from the public
// download link, which is the Unsplash-sanctioned way to fetch a photo.
async function resolveSource(photo) {
  if (photo.cdn) return `https://images.unsplash.com/${photo.cdn}`;
  const res = await fetch(`https://unsplash.com/photos/${photo.id}/download?force=true`, { redirect: 'manual' });
  const loc = res.headers.get('location');
  if (!loc) throw new Error(`Could not resolve Unsplash photo ${photo.id} (HTTP ${res.status})`);
  return loc.split('?')[0];
}

const uploaded = {};

async function upload(key) {
  if (uploaded[key]) return uploaded[key];
  const photo = PHOTOS[key];
  const publicId = `kora/${key}`;
  let info;
  try {
    info = await cloudinary.api.resource(publicId); // already uploaded on a previous run
  } catch {
    const source = photo.sourceUrl ?? await resolveSource(photo);
    info = await cloudinary.uploader.upload(`${source}?w=2400&q=85&fm=jpg`, {
      public_id: publicId,
      overwrite: false,
      resource_type: 'image',
    });
  }
  uploaded[key] = {
    publicId,
    version: info.version,
    url: info.secure_url,
    width: info.width,
    height: info.height,
    alt: photo.alt,
    credit: { name: photo.by, url: `https://unsplash.com/photos/${photo.id}` },
  };
  return uploaded[key];
}

// Relative crop of an uploaded photo: fractions of width/height.
function crop(base, { x, y, w, h }, alt) {
  const url = cloudinary.url(base.publicId, {
    secure: true,
    version: base.version,
    format: 'jpg',
    transformation: [{ crop: 'crop', x, y, width: w, height: h }],
  });
  return { url, alt, width: Math.round(base.width * w), height: Math.round(base.height * h), credit: base.credit };
}

const img = (base, role, alt = base.alt) => ({ url: base.url, alt, role, width: base.width, height: base.height, credit: base.credit });
const cropImg = (base, role, box, alt) => ({ ...crop(base, box, alt), role });

// ---------------------------------------------------------------------------
// Garments
// ---------------------------------------------------------------------------
const TOPS = ['S', 'M', 'L', 'XL'];
const WOMENS = ['XS', 'S', 'M', 'L'];
const WAIST = ['28', '30', '32', '34', '36'];

const variants = (code, sizes, stock) => sizes.map((size, i) => ({ size, sku: `KR-${code}-${size}`, stock: stock[i] }));

async function buildProducts(cat, ed) {
  const p = {};
  for (const key of Object.keys(PHOTOS)) p[key] = await upload(key);

  return [
    {
      slug: 'the-long-coat-ivory',
      name: 'The Long Coat',
      subtitle: 'Ivory wool-cashmere',
      price: 12900,
      category: cat.outerwear, edition: ed.longCoat,
      description: 'A single-breasted overcoat cut long and easy through the shoulder, in a dense ivory wool with a little cashmere for hand.',
      story: 'We started with the coat our grandfathers wore to the station: long enough to cover a jacket, plain enough to wear over a roll-neck. The cloth is milled tight so it keeps its line, then brushed once so it softens with you. Horn buttons, flap pockets set low, and a full back vent.',
      images: [
        img(p.coatIvory, 'model'),
        cropImg(p.coatIvory, 'detail', { x: 0.33, y: 0.14, w: 0.36, h: 0.2 }, 'The notch lapel of the ivory coat over a grey roll-neck'),
        cropImg(p.coatIvory, 'detail', { x: 0.36, y: 0.33, w: 0.38, h: 0.22 }, 'The low flap pocket and soft wool face of the ivory coat'),
      ],
      variants: variants('LC01', TOPS, [4, 7, 2, 0]),
      colorway: { name: 'Ivory', swatch: 'oklch(0.92 0.02 85)' },
      fabric: { composition: [{ fiber: 'Wool', percent: 90 }, { fiber: 'Cashmere', percent: 10 }], weightGsm: 520, weave: 'Melton twill, single-brushed', origin: 'Milled in Biella, Italy', care: ['Dry clean only', 'Hang on a broad hanger', 'Brush after wear'] },
      fit: { cut: 'relaxed', modelHeightCm: 185, modelWears: 'M', notes: 'Cut with room for a knit underneath. Take your usual size, or size down for a closer line.' },
      measurements: [
        { size: 'S', chest: 112, length: 108, sleeve: 63 },
        { size: 'M', chest: 118, length: 110, sleeve: 64 },
        { size: 'L', chest: 124, length: 112, sleeve: 65 },
        { size: 'XL', chest: 130, length: 114, sleeve: 66 },
      ],
      hotspots: [
        { x: 55, y: 22, label: 'Notch lapel', detail: 'Hand-rolled, so it lies flat over a knit without a press.' },
        { x: 56, y: 43, label: 'Flap pockets', detail: 'Set low and lined in cotton twill, deep enough for both hands.' },
        { x: 55, y: 66, label: 'Long hem', detail: 'Falls to the knee, with a full back vent for an easy stride.' },
      ],
      tags: ['Edition 01', 'Wool-cashmere'],
      featured: { hero: true, order: 1 },
    },
    {
      slug: 'the-double-breasted-coat-oat',
      name: 'The Double-Breasted Coat',
      subtitle: 'Oat boiled wool',
      price: 13900,
      category: cat.outerwear, edition: ed.longCoat,
      description: 'Six buttons, a wide peak lapel and a self belt. Boiled wool keeps it light enough to wear open.',
      story: 'A city coat for days that start cold and end warm. Boiling the wool shrinks it into a dense felt that needs no lining, so the coat drapes instead of standing stiff.',
      images: [
        img(p.coatOat, 'model'),
        cropImg(p.coatOat, 'detail', { x: 0.2, y: 0.28, w: 0.6, h: 0.3 }, 'Peak lapels and buttons of the oat double-breasted coat'),
      ],
      variants: variants('DB02', TOPS, [3, 5, 5, 2]),
      colorway: { name: 'Oat', swatch: 'oklch(0.86 0.03 80)' },
      fabric: { composition: [{ fiber: 'Wool', percent: 100 }], weightGsm: 480, weave: 'Boiled wool', origin: 'Milled in Prato, Italy', care: ['Dry clean only', 'Steam to refresh'] },
      fit: { cut: 'regular', modelHeightCm: 183, modelWears: 'M', notes: 'True to size. Belted, it sits closer at the waist.' },
      measurements: [
        { size: 'S', chest: 108, length: 104, sleeve: 63 },
        { size: 'M', chest: 114, length: 106, sleeve: 64 },
        { size: 'L', chest: 120, length: 108, sleeve: 65 },
        { size: 'XL', chest: 126, length: 110, sleeve: 66 },
      ],
      tags: ['Edition 01', 'Unlined'],
      featured: { order: 4 },
    },
    {
      slug: 'the-field-coat-olive',
      name: 'The Field Coat',
      subtitle: 'Olive wool gabardine',
      price: 11500,
      category: cat.outerwear, edition: ed.longCoat,
      description: 'A long military coat with epaulettes and a storm flap, in a water-shedding wool gabardine.',
      story: 'Borrowed from an archive greatcoat and pared back: the epaulettes stay, the brass goes. Gabardine is woven so tightly that light rain beads and rolls off.',
      images: [
        img(p.coatOlive, 'model'),
        cropImg(p.coatOlive, 'detail', { x: 0.25, y: 0.22, w: 0.5, h: 0.3 }, 'Shoulder and storm flap of the olive field coat'),
      ],
      variants: variants('FC03', TOPS, [2, 4, 3, 1]),
      colorway: { name: 'Olive', swatch: 'oklch(0.42 0.05 120)' },
      fabric: { composition: [{ fiber: 'Wool', percent: 100 }], weightGsm: 410, weave: 'Gabardine', origin: 'Woven in Yorkshire, England', care: ['Dry clean only'] },
      fit: { cut: 'regular', modelHeightCm: 180, modelWears: 'M', notes: 'Structured through the shoulder. Size up to layer over tailoring.' },
      measurements: [
        { size: 'S', chest: 106, length: 112, sleeve: 63 },
        { size: 'M', chest: 112, length: 114, sleeve: 64 },
        { size: 'L', chest: 118, length: 116, sleeve: 65 },
        { size: 'XL', chest: 124, length: 118, sleeve: 66 },
      ],
      tags: ['Edition 01', 'Water-shedding'],
      featured: { order: 6 },
    },
    {
      slug: 'the-long-blazer-ash',
      name: 'The Long Blazer',
      subtitle: 'Ash wool crepe',
      price: 8900,
      category: cat.tailoring, edition: ed.longCoat,
      description: 'An elongated, single-button blazer that can be belted and worn as a dress.',
      story: 'Tailoring with the stiffness taken out. Wool crepe has a dry, grainy hand and a fall that suits a longer line; we left the shoulder soft and the canvas light.',
      images: [
        img(p.blazer, 'model'),
        cropImg(p.blazer, 'detail', { x: 0.3, y: 0.15, w: 0.45, h: 0.3 }, 'Lapel and single button of the ash long blazer'),
      ],
      variants: variants('LB04', WOMENS, [3, 6, 4, 2]),
      colorway: { name: 'Ash', swatch: 'oklch(0.80 0.01 80)' },
      fabric: { composition: [{ fiber: 'Wool', percent: 96 }, { fiber: 'Elastane', percent: 4 }], weightGsm: 290, weave: 'Crepe', origin: 'Woven in Ludhiana, India', care: ['Dry clean only', 'Cool iron through a cloth'] },
      fit: { cut: 'relaxed', modelHeightCm: 176, modelWears: 'S', notes: 'Falls mid-thigh. Choose your usual size.' },
      measurements: [
        { size: 'XS', chest: 92, length: 84, sleeve: 59 },
        { size: 'S', chest: 96, length: 86, sleeve: 60 },
        { size: 'M', chest: 100, length: 88, sleeve: 61 },
        { size: 'L', chest: 106, length: 90, sleeve: 62 },
      ],
      tags: ['Edition 01', 'Wear as a dress'],
      featured: { order: 2 },
    },
    {
      slug: 'the-rib-crew-ecru',
      name: 'The Rib Crew',
      subtitle: 'Ecru merino rib',
      price: 5400,
      category: cat.knitwear, edition: ed.softKnits,
      description: 'A 2×2 rib crewneck in extra-fine merino, knitted on a 7-gauge frame for a soft, open hand.',
      story: 'Rib usually lives at the cuffs; here it runs the whole body, so the sweater moves with you and springs back after a day of wear.',
      images: [
        img(p.knitEcru, 'model'),
        img(p.knitMacro, 'detail', 'Close-up of the ecru rib stitch'),
      ],
      variants: variants('RC05', TOPS, [6, 8, 5, 3]),
      colorway: { name: 'Ecru', swatch: 'oklch(0.94 0.02 90)' },
      fabric: { composition: [{ fiber: 'Merino wool', percent: 100 }], weightGsm: 340, weave: '7-gauge 2×2 rib', origin: 'Knitted in Ludhiana, India', care: ['Hand wash cold', 'Dry flat', 'Fold, never hang'] },
      fit: { cut: 'relaxed', modelHeightCm: 172, modelWears: 'M', notes: 'Generous through the body with a dropped shoulder.' },
      measurements: [
        { size: 'S', chest: 108, length: 66, sleeve: 58 },
        { size: 'M', chest: 114, length: 68, sleeve: 59 },
        { size: 'L', chest: 120, length: 70, sleeve: 60 },
        { size: 'XL', chest: 126, length: 72, sleeve: 61 },
      ],
      tags: ['Soft Knits', 'Extra-fine merino'],
      featured: { order: 3 },
    },
    {
      slug: 'the-knit-set-oat',
      name: 'The Knit Set',
      subtitle: 'Oat cotton-cashmere',
      price: 7800,
      category: cat.knitwear, edition: ed.softKnits,
      description: 'A raglan sweater and a matching midi skirt in a cotton-cashmere jersey knit. Sold as a set.',
      story: 'Two pieces that read as one. Cotton keeps it breathable for most of the year; a little cashmere makes it warm enough for the first cold mornings.',
      images: [
        img(p.knitSet, 'model'),
        cropImg(p.knitSet, 'detail', { x: 0.3, y: 0.3, w: 0.4, h: 0.3 }, 'Raglan seam and knit texture of the oat set'),
      ],
      variants: variants('KS06', WOMENS, [2, 4, 3, 0]),
      colorway: { name: 'Oat', swatch: 'oklch(0.88 0.03 80)' },
      fabric: { composition: [{ fiber: 'Cotton', percent: 85 }, { fiber: 'Cashmere', percent: 15 }], weightGsm: 300, weave: '12-gauge jersey', origin: 'Knitted in Tiruppur, India', care: ['Hand wash cold', 'Dry flat'] },
      fit: { cut: 'regular', modelHeightCm: 170, modelWears: 'S', notes: 'The skirt has a soft elastic waist and falls mid-calf.' },
      measurements: [
        { size: 'XS', chest: 90, length: 58, waist: 64 },
        { size: 'S', chest: 94, length: 60, waist: 68 },
        { size: 'M', chest: 100, length: 62, waist: 72 },
        { size: 'L', chest: 106, length: 64, waist: 78 },
      ],
      tags: ['Soft Knits', 'Two pieces'],
      featured: { order: 7 },
    },
    {
      slug: 'the-loopback-hoodie-bark',
      name: 'The Loopback Hoodie',
      subtitle: 'Bark heavyweight cotton',
      price: 3990,
      category: cat.jersey, edition: ed.everyday,
      description: 'A heavyweight hoodie in 420 gsm loopback cotton, garment-dyed and washed twice.',
      story: 'Loopback is knitted with loops on the inside instead of brushed fleece, so it breathes and never pills. Washing it twice before it leaves us means it won\'t shrink on you.',
      images: [
        img(p.hoodie, 'model'),
        cropImg(p.hoodie, 'detail', { x: 0.28, y: 0.38, w: 0.45, h: 0.3 }, 'Drawstring hood and chest of the bark hoodie'),
      ],
      variants: variants('LH07', TOPS, [9, 12, 8, 4]),
      colorway: { name: 'Bark', swatch: 'oklch(0.30 0.03 50)' },
      fabric: { composition: [{ fiber: 'Organic cotton', percent: 100 }], weightGsm: 420, weave: 'Loopback jersey', origin: 'Knitted and dyed in Tiruppur, India', care: ['Machine wash 30°C inside out', 'Tumble dry low'] },
      fit: { cut: 'oversized', modelHeightCm: 182, modelWears: 'L', notes: 'Boxy and short in the body. Size down for a regular fit.' },
      measurements: [
        { size: 'S', chest: 116, length: 66, sleeve: 58 },
        { size: 'M', chest: 122, length: 68, sleeve: 59 },
        { size: 'L', chest: 128, length: 70, sleeve: 60 },
        { size: 'XL', chest: 134, length: 72, sleeve: 61 },
      ],
      tags: ['Everyday Cotton', '420 gsm'],
      featured: { order: 8 },
    },
    {
      slug: 'the-summer-shirt-turmeric',
      name: 'The Summer Shirt',
      subtitle: 'Turmeric cotton voile',
      price: 2990,
      category: cat.shirts, edition: ed.everyday,
      description: 'A loose, lightweight shirt in turmeric-yellow cotton voile, with one chest pocket and sleeves made to roll.',
      story: 'Turmeric is the colour of an Indian summer, so we dyed for it: a warm, sunlit yellow that softens a little with every wash. Voile is woven fine and open, so the shirt moves air on the hottest afternoons. Wear it open over a tee, or buttoned with the sleeves rolled twice.',
      images: [
        cropImg(p.shirtYellow, 'model', { x: 0.15, y: 0.2, w: 0.7, h: 0.56 }, 'Man in a turmeric-yellow shirt with the sleeves rolled, hands in his pockets'),
        cropImg(p.shirtYellow, 'detail', { x: 0.38, y: 0.4, w: 0.32, h: 0.18 }, 'Chest pocket and fine voile weave of the turmeric shirt'),
        img(p.shirtYellow, 'look'),
      ],
      variants: variants('SS08', TOPS, [5, 8, 6, 2]),
      colorway: { name: 'Turmeric', swatch: 'oklch(0.88 0.13 100)' },
      fabric: { composition: [{ fiber: 'Cotton', percent: 100 }], weightGsm: 95, weave: 'Voile', origin: 'Woven in Ahmedabad, India', care: ['Machine wash 30°C', 'Dry in shade to keep the colour', 'Warm iron'] },
      fit: { cut: 'relaxed', modelHeightCm: 178, modelWears: 'M', notes: 'Relaxed through the body with a dropped shoulder. Take your usual size.' },
      measurements: [
        { size: 'S', chest: 112, length: 74, sleeve: 60 },
        { size: 'M', chest: 118, length: 76, sleeve: 61 },
        { size: 'L', chest: 124, length: 78, sleeve: 62 },
        { size: 'XL', chest: 130, length: 80, sleeve: 63 },
      ],
      tags: ['Everyday Cotton', 'Lightweight voile'],
      featured: { order: 5 },
    },
    {
      slug: 'the-baggy-trouser-chalk',
      name: 'The Baggy Trouser',
      subtitle: 'Chalk cotton twill',
      price: 3890,
      category: cat.trousers, edition: ed.everyday,
      description: 'A high-rise trouser cut full through the hip and thigh, with a wide, straight leg that pools over trainers.',
      story: 'The silhouette of the moment, made to outlast it. Heavy cotton twill holds a soft crease and keeps its chalk white through hot washes. A deep rise and a roomy seat mean it moves the way the leg looks like it should.',
      images: [
        cropImg(p.nightBaggy, 'model', { x: 0.12, y: 0.38, w: 0.76, h: 0.6 }, 'Baggy chalk-white trousers mid-stride under blue stage light'),
        img(p.nightBaggy, 'look'),
        cropImg(p.shirtYellow, 'model', { x: 0.15, y: 0.58, w: 0.7, h: 0.42 }, 'Chalk-white trousers worn with a yellow shirt, hands in the pockets'),
        cropImg(p.nightBaggy, 'detail', { x: 0.3, y: 0.42, w: 0.42, h: 0.22 }, 'High waist and full leg of the chalk baggy trouser'),
      ],
      variants: variants('BT09', WAIST, [4, 7, 8, 5, 2]),
      colorway: { name: 'Chalk', swatch: 'oklch(0.96 0.008 90)' },
      fabric: { composition: [{ fiber: 'Cotton', percent: 100 }], weightGsm: 300, weave: 'Twill', origin: 'Woven in Bhilwara, India', care: ['Machine wash 40°C', 'Line dry', 'Warm iron'] },
      fit: { cut: 'oversized', modelHeightCm: 180, modelWears: '32', notes: 'Cut deliberately full. Take your usual waist size; size down for a less slouchy leg.' },
      measurements: [
        { size: '28', waist: 72, inseam: 80 },
        { size: '30', waist: 77, inseam: 81 },
        { size: '32', waist: 82, inseam: 82 },
        { size: '34', waist: 87, inseam: 83 },
        { size: '36', waist: 92, inseam: 84 },
      ],
      tags: ['Everyday Cotton', 'Wide leg'],
      featured: { order: 3 },
    },
    {
      slug: 'the-heavy-tee-ink',
      name: 'The Heavy Tee',
      subtitle: 'Ink 260 gsm jersey',
      price: 1890,
      category: cat.jersey, edition: ed.everyday,
      description: 'A heavyweight crewneck tee in 260 gsm combed cotton with a close, ribbed collar that keeps its shape.',
      story: 'Heavy enough to wear on its own, cut to sit right under a coat. The collar is a 1×1 rib bound with a twin-needle stitch, so it never ripples after washing.',
      images: [
        img(p.teeInkA, 'model'),
        img(p.teeInkB, 'model'),
        img(p.teeInkC, 'look'),
      ],
      variants: variants('HT10', TOPS, [14, 20, 16, 9]),
      colorway: { name: 'Ink', swatch: 'oklch(0.18 0.01 60)' },
      fabric: { composition: [{ fiber: 'Combed cotton', percent: 100 }], weightGsm: 260, weave: 'Single jersey', origin: 'Knitted in Tiruppur, India', care: ['Machine wash 30°C', 'Dry in shade'] },
      fit: { cut: 'regular', modelHeightCm: 180, modelWears: 'M', notes: 'Straight through the body, sleeves end mid-bicep.' },
      measurements: [
        { size: 'S', chest: 100, length: 70, sleeve: 21 },
        { size: 'M', chest: 106, length: 72, sleeve: 22 },
        { size: 'L', chest: 112, length: 74, sleeve: 23 },
        { size: 'XL', chest: 118, length: 76, sleeve: 24 },
      ],
      tags: ['Everyday Cotton', '260 gsm'],
      featured: { order: 10 },
    },
    {
      slug: 'the-heavy-tee-bone',
      name: 'The Heavy Tee, Bone',
      subtitle: 'Bone 260 gsm jersey',
      price: 1890,
      category: cat.jersey, edition: ed.everyday,
      description: 'Our heavyweight crewneck in an undyed bone white. 260 gsm combed cotton, ribbed collar.',
      story: 'The same tee as Ink, left the colour of the cotton itself. No optical brighteners, so it softens to an even warmer white over time.',
      images: [
        img(p.teeBoneA, 'flat'),
        img(p.teeBoneB, 'flat'),
      ],
      variants: variants('HT11', TOPS, [11, 0, 13, 7]),
      colorway: { name: 'Bone', swatch: 'oklch(0.95 0.015 85)' },
      fabric: { composition: [{ fiber: 'Combed cotton', percent: 100 }], weightGsm: 260, weave: 'Single jersey', origin: 'Knitted in Tiruppur, India', care: ['Machine wash 30°C', 'Dry in shade'] },
      fit: { cut: 'regular', modelHeightCm: 180, modelWears: 'M', notes: 'Straight through the body, sleeves end mid-bicep.' },
      measurements: [
        { size: 'S', chest: 100, length: 70, sleeve: 21 },
        { size: 'M', chest: 106, length: 72, sleeve: 22 },
        { size: 'L', chest: 112, length: 74, sleeve: 23 },
        { size: 'XL', chest: 118, length: 76, sleeve: 24 },
      ],
      tags: ['Everyday Cotton', 'Undyed'],
      featured: { order: 11 },
    },
    {
      slug: 'the-heavy-tee-sage',
      name: 'The Heavy Tee, Sage',
      subtitle: 'Sage 260 gsm jersey',
      price: 1890,
      category: cat.jersey, edition: ed.everyday,
      description: 'Our heavyweight crewneck in a soft sage green. 260 gsm combed cotton, ribbed collar.',
      story: 'The same tee as Ink and Bone, garment-dyed a muted green that sits easily with white trousers, denim and khaki. Garment dyeing gives every piece a slightly lived-in depth of colour.',
      images: [
        // Crops stop above the stock photo's neck label, which carries another brand's name.
        cropImg(p.teeSage, 'flat', { x: 0.5, y: 0.4, w: 0.38, h: 0.39 }, 'Shoulder and ribbed collar of a sage-green tee on a wooden hanger'),
        cropImg(p.teeSage, 'detail', { x: 0.18, y: 0.5, w: 0.3, h: 0.27 }, 'Ribbed collar and garment-dyed sage jersey'),
      ],
      variants: variants('HT13', TOPS, [9, 14, 12, 6]),
      colorway: { name: 'Sage', swatch: 'oklch(0.70 0.04 160)' },
      fabric: { composition: [{ fiber: 'Combed cotton', percent: 100 }], weightGsm: 260, weave: 'Single jersey, garment-dyed', origin: 'Knitted and dyed in Tiruppur, India', care: ['Machine wash 30°C inside out', 'Dry in shade'] },
      fit: { cut: 'regular', modelHeightCm: 180, modelWears: 'M', notes: 'Straight through the body, sleeves end mid-bicep.' },
      measurements: [
        { size: 'S', chest: 100, length: 70, sleeve: 21 },
        { size: 'M', chest: 106, length: 72, sleeve: 22 },
        { size: 'L', chest: 112, length: 74, sleeve: 23 },
        { size: 'XL', chest: 118, length: 76, sleeve: 24 },
      ],
      tags: ['Everyday Cotton', 'Garment-dyed'],
      featured: { order: 6 },
    },
    {
      slug: 'the-tee-dress-bone',
      name: 'The Tee Dress',
      subtitle: 'Bone cotton jersey',
      price: 2690,
      category: cat.dresses, edition: ed.everyday,
      description: 'An oversized tee lengthened to just above the knee, in the same 260 gsm jersey as our Heavy Tee.',
      story: 'What happens when you keep cutting a tee longer. Dropped shoulders and a straight body; belt it, or wear it loose with flat shoes.',
      images: [
        img(p.teeDress, 'model'),
        cropImg(p.teeDress, 'detail', { x: 0.25, y: 0.22, w: 0.5, h: 0.3 }, 'Dropped shoulder and collar of the bone tee dress'),
      ],
      variants: variants('TD12', WOMENS, [4, 6, 5, 2]),
      colorway: { name: 'Bone', swatch: 'oklch(0.95 0.015 85)' },
      fabric: { composition: [{ fiber: 'Combed cotton', percent: 100 }], weightGsm: 260, weave: 'Single jersey', origin: 'Knitted in Tiruppur, India', care: ['Machine wash 30°C', 'Dry in shade'] },
      fit: { cut: 'oversized', modelHeightCm: 168, modelWears: 'S', notes: 'Roomy. Size down for a closer fit.' },
      measurements: [
        { size: 'XS', chest: 110, length: 88 },
        { size: 'S', chest: 116, length: 90 },
        { size: 'M', chest: 122, length: 92 },
        { size: 'L', chest: 128, length: 94 },
      ],
      tags: ['Everyday Cotton', 'Oversized'],
      featured: { order: 12 },
    },
  ];
}

const TEST_PRODUCT_NAMES = ['vishal', 'demand_room_01', 'sdf', 'bgyuh', 'new'];

async function upsertCategory(name, description) {
  return Category.findOneAndUpdate(
    { name },
    { $set: { name, description, status: 'Active' } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

async function main() {
  await mongoose.connect(`${process.env.MONGOURL}/${DB_NAME}`);
  console.log('Connected to MongoDB');

  const archived = await Product.updateMany({ name: { $in: TEST_PRODUCT_NAMES }, slug: { $exists: false } }, { $set: { isArchived: true } });
  console.log(`Archived ${archived.modifiedCount} test product(s)`);

  const cat = {
    outerwear: await upsertCategory('outerwear', 'coats and jackets'),
    tailoring: await upsertCategory('tailoring', 'blazers and structured pieces'),
    knitwear: await upsertCategory('knitwear', 'sweaters and knit sets'),
    jersey: await upsertCategory('jersey', 'tees and sweatshirts'),
    shirts: await upsertCategory('shirts', 'woven shirts'),
    trousers: await upsertCategory('trousers', 'trousers'),
    dresses: await upsertCategory('dresses', 'dresses'),
  };

  console.log('Uploading photographs to Cloudinary…');
  for (const key of Object.keys(PHOTOS)) {
    const u = await upload(key);
    console.log(`  ${key.padEnd(13)} ${u.width}×${u.height}`);
  }

  const edition = async (doc) => Collection.findOneAndUpdate({ slug: doc.slug }, { $set: doc }, { upsert: true, new: true });
  const ed = {
    longCoat: await edition({
      slug: 'edition-01-the-long-coat', name: 'Long Lines', season: 'Edition 01 · Autumn–Winter 2026', order: 1,
      intro: 'Four long garments in wool, cut to cover everything underneath.',
      cover: { url: uploaded.rackBoutique.url, alt: uploaded.rackBoutique.alt, credit: uploaded.rackBoutique.credit },
    }),
    everyday: await edition({
      slug: 'everyday-cotton', name: 'Everyday Cotton', season: 'All year', order: 2,
      intro: 'Heavy tees, a white shirt and a pleated trouser. The things you wear most, made to last longest.',
      cover: { url: uploaded.fabricFlow.url, alt: uploaded.fabricFlow.alt, credit: uploaded.fabricFlow.credit },
    }),
    softKnits: await edition({
      slug: 'soft-knits', name: 'Soft Knits', season: 'Autumn–Winter 2026', order: 3,
      intro: 'Merino rib and cotton-cashmere, knitted slow on old frames.',
      cover: { url: uploaded.rackNeutral.url, alt: uploaded.rackNeutral.alt, credit: uploaded.rackNeutral.credit },
    }),
  };

  // The hero coat was re-shot: keep the same product document (and any bag
  // lines pointing at it) and move it to its new slug.
  await Product.updateOne({ slug: 'the-long-coat-camel' }, { $set: { slug: 'the-long-coat-ivory' } });
  await Product.updateOne({ slug: 'the-poplin-shirt-white' }, { $set: { slug: 'the-summer-shirt-turmeric' } });
  await Product.updateOne({ slug: 'the-pleated-trouser-stone' }, { $set: { slug: 'the-baggy-trouser-chalk' } });

  const products = await buildProducts(cat, ed);
  const bySlug = {};
  for (const doc of products) {
    doc.stock = doc.variants.reduce((n, v) => n + v.stock, 0);
    doc.image = doc.images[0].url; // keeps the admin table and old views working
    doc.isArchived = false;
    bySlug[doc.slug] = await Product.findOneAndUpdate({ slug: doc.slug }, { $set: doc }, { upsert: true, new: true, runValidators: true });
    console.log(`  product  ${doc.slug}`);
  }

  const looks = [
    { slug: 'look-01', number: 1, title: 'The long coat, over a roll-neck', caption: 'The Long Coat in Ivory.', photo: 'coatIvory', items: [['the-long-coat-ivory', 56, 40]] },
    { slug: 'look-02', number: 2, title: 'Yellow shirt, white trouser', caption: 'The Summer Shirt in Turmeric and the Baggy Trouser in Chalk.', photo: 'shirtYellow', items: [['the-summer-shirt-turmeric', 50, 50], ['the-baggy-trouser-chalk', 45, 82]] },
    { slug: 'look-03', number: 3, title: 'Tailoring, softened', caption: 'The Long Blazer in Ash, worn as a dress.', photo: 'blazer', items: [['the-long-blazer-ash', 54, 40]] },
    { slug: 'look-04', number: 4, title: 'Two pieces, one colour', caption: 'The Knit Set in Oat.', photo: 'knitSet', items: [['the-knit-set-oat', 50, 45]] },
    { slug: 'look-05', number: 5, title: 'The tee, on its own', caption: 'The Heavy Tee in Ink.', photo: 'teeInkC', items: [['the-heavy-tee-ink', 38, 72]] },
    { slug: 'look-06', number: 6, title: 'After dark', caption: 'The Baggy Trouser in Chalk, under stage light.', photo: 'nightBaggy', items: [['the-baggy-trouser-chalk', 45, 62]] },
  ];
  for (const [order, l] of looks.entries()) {
    const u = uploaded[l.photo];
    await Look.findOneAndUpdate({ slug: l.slug }, {
      $set: {
        slug: l.slug, number: l.number, title: l.title, caption: l.caption, order,
        image: { url: u.url, alt: u.alt, width: u.width, height: u.height, credit: u.credit },
        items: l.items.map(([slug, x, y]) => ({ product: bySlug[slug]._id, x, y })),
      },
    }, { upsert: true, new: true });
    console.log(`  look     ${l.slug}`);
  }

  const assets = {
    'brand-note': 'brick',
    'empty-bag': 'hangers',
    'texture-woven': 'wovenMacro',
    'texture-knit': 'knitMacro',
    'fabric-flow': 'fabricFlow',
  };
  for (const [key, photo] of Object.entries(assets)) {
    const u = uploaded[photo];
    await Asset.findOneAndUpdate({ key }, { $set: { key, url: u.url, alt: u.alt, width: u.width, height: u.height, credit: u.credit } }, { upsert: true });
    console.log(`  asset    ${key}`);
  }

  console.log(`Done: ${products.length} products, ${Object.keys(ed).length} editions, ${looks.length} looks.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('Seed failed:', err.message ?? err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
