#!/usr/bin/env python3
"""Genera placas de identificación SINTÉTICAS de equipo médico para probar la lectura.

Marcas, modelos, series y códigos son ficticios: son las seis marcas inventadas que el reto de
Philips entrega en su hoja de referencia. No reproduce ninguna placa real.

Cada placa lleva los campos que exige la norma ISO 15223-1 para identificación de producto
sanitario (fabricante, modelo, número de serie, fecha de fabricación) y un identificador único
de producto en el formato de cadena de elementos GS1: (01) el código de producto, (21) el número
de serie, (11) la fecha de fabricación. Ese formato es lo que hace que la placa sea legible sin
modelo de IA: el código trae el modelo y la serie, y la vista solo confirma lo impreso.

Uso:  python3 fixtures/placas/generar.py            → 20 placas en fixtures/placas/
      python3 fixtures/placas/generar.py --limpias  → solo las nítidas
"""
import json
import random
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

AQUI = Path(__file__).resolve().parent
FUENTE = "/usr/share/fonts/liberation-sans-fonts/LiberationSans-{}.ttf"

# Las seis marcas ficticias del reto y modelos inventados con su prefijo de producto.
CATALOGO = [
    ("NovaMed", "NM-MR 700", "MR", "07612345000017"),
    ("NovaMed", "NM-US 55", "Ultrasound", "07612345000024"),
    ("Aurelia Health", "AH-CT 320", "CT", "07698765000011"),
    ("Aurelia Health", "AH-MR 650", "MR", "07698765000028"),
    ("BluePeak Medical", "BP-MR 500", "MR", "07655544000015"),
    ("BluePeak Medical", "BP-CT 610", "CT", "07655544000022"),
    ("Orion Imaging", "OI-CT 450", "CT", "07611122000019"),
    ("Orion Imaging", "OI-MR 620", "MR", "07611122000026"),
    ("HelixCare", "HC-US 40", "Ultrasound", "07633366000013"),
    ("Zenith MedTech", "ZM-CT 430", "CT", "07677788000010"),
]
DIFICULTADES = ["nitida", "borrosa", "inclinada", "reflejo", "oscura"]


def fuente(tam, negrita=False):
    return ImageFont.truetype(FUENTE.format("Bold" if negrita else "Regular"), tam)


def placa(marca, modelo, modalidad, gtin, serie, anio, mes, dificultad, semilla):
    rnd = random.Random(semilla)
    W, H = 900, 560
    img = Image.new("RGB", (W, H), (223, 224, 226))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([14, 14, W - 14, H - 14], 18, fill=(238, 239, 240), outline=(120, 124, 128), width=3)

    d.text((44, 40), marca.upper(), font=fuente(46, True), fill=(28, 30, 34))
    d.line([44, 100, W - 44, 100], fill=(120, 124, 128), width=3)

    filas = [
        ("MODEL", modelo),
        ("TYPE", modalidad),
        ("S/N", serie),
        ("REF", gtin[-8:]),
        ("MFG DATE", f"{anio}-{mes:02d}"),
        ("INPUT", "100-240V~ 50/60Hz 6.0A"),
    ]
    y = 126
    for etiqueta, valor in filas:
        d.text((44, y), etiqueta, font=fuente(24), fill=(90, 94, 99))
        d.text((250, y - 4), valor, font=fuente(30, True), fill=(24, 26, 30))
        y += 52

    # Cadena de elementos GS1 impresa bajo la placa: (01) producto, (21) serie, (11) fabricación.
    cadena = f"(01){gtin}(11){str(anio)[2:]}{mes:02d}01(21){serie}"
    d.text((44, H - 92), cadena, font=fuente(22), fill=(24, 26, 30))
    d.text((44, H - 58), "SYNTHETIC LABEL — HACKATHON TEST ONLY", font=fuente(18), fill=(150, 60, 40))

    if dificultad == "borrosa":
        img = img.filter(ImageFilter.GaussianBlur(rnd.uniform(1.6, 2.6)))
    elif dificultad == "inclinada":
        img = img.rotate(rnd.uniform(-9, 9), expand=True, fillcolor=(200, 201, 203), resample=Image.BICUBIC)
    elif dificultad == "reflejo":
        brillo = Image.new("RGB", img.size, (0, 0, 0))
        ImageDraw.Draw(brillo).polygon([(120, 0), (430, 0), (240, H), (0, H)], fill=(90, 90, 88))
        img = Image.blend(img, Image.blend(img, brillo, 0.0), 0.0)
        img = Image.eval(img, lambda p: p)
        capa = Image.new("RGB", img.size, (255, 255, 255))
        mascara = Image.new("L", img.size, 0)
        ImageDraw.Draw(mascara).polygon([(150, 0), (460, 0), (270, img.size[1]), (10, img.size[1])], fill=110)
        img = Image.composite(capa, img, mascara.filter(ImageFilter.GaussianBlur(28)))
    elif dificultad == "oscura":
        img = Image.eval(img, lambda p: int(p * 0.42))

    return img, cadena


def main():
    solo_limpias = "--limpias" in sys.argv
    rnd = random.Random(20260909)
    verdad = []
    for i, (marca, modelo, modalidad, gtin) in enumerate(CATALOGO):
        dificultades = ["nitida"] if solo_limpias else ["nitida", DIFICULTADES[1 + i % 4]]
        for dif in dificultades:
            serie = f"{modelo.split()[0].replace('-', '')}{rnd.randint(10**6, 10**7 - 1)}"
            anio, mes = rnd.randint(2014, 2024), rnd.randint(1, 12)
            img, cadena = placa(marca, modelo, modalidad, gtin, serie, anio, mes, dif, semilla=i * 7 + len(dif))
            nombre = f"{modelo.replace(' ', '').replace('-', '').lower()}-{dif}.png"
            img.save(AQUI / nombre)
            verdad.append({"archivo": nombre, "dificultad": dif, "manufacturer": marca, "model": modelo,
                           "modality": modalidad, "serial": serie, "gtin": gtin,
                           "mfg": f"{anio}-{mes:02d}", "gs1": cadena})
    (AQUI / "verdad.json").write_text(json.dumps(verdad, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{len(verdad)} placas sintéticas en {AQUI}")


if __name__ == "__main__":
    main()
