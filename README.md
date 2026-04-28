# SiclosContables

Plataforma web de contabilidad inteligente que transforma operaciones en lenguaje natural en un ciclo contable completo:

- Asientos contables automáticos
- Cuentas T
- Balanza de comprobación
- Estado de resultados
- Estado de situación financiera
- Historial y dashboard en tiempo real

## Ejecutar

Como es una app estática, puedes abrir `index.html` directamente en el navegador o servirla localmente:

```bash
python3 -m http.server 8000
```

Luego abre `http://localhost:8000`.

## Ejemplos de entrada

- `Se obtuvieron ingresos por trabajo en efectivo por $500`
- `Pagué renta del local por $800 con banco`
- `Compré equipo por $1200 a crédito`
