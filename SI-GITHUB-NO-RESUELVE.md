# Si aparece: `Could not resolve host: github.com`

Significa que **DNS o la red** no llegan a GitHub (muy habitual en **Wi‑Fi corporativo**, VPN o filtros).

## Prueba rápida (en este orden)

1. **Abre el navegador** y entra en **https://github.com**  
   - Si **tampoco carga** → es red/firewall de la empresa o del proveedor.  
   - Si **sí carga** → prueba de nuevo el `.bat`; a veces es intermitente.

2. **Otra red** (la que mejor funciona):  
   - **Datos móviles** del teléfono como **hotspot** y conecta el PC → ejecuta `HAZLO-AUTOMATICO.bat` otra vez.

3. **DNS en Windows** (como administrador en CMD):  
   ```bat
   ipconfig /flushdns
   ```

4. **VPN**  
   - Si usas VPN de empresa: prueba **desconectar** o al revés **conectar** (según política de la org).

5. **IT / seguridad**  
   - Pide que permitan **`github.com`** y **`*.github.com`** (puerto **443** HTTPS) para `git` y el navegador.

## Mientras no puedas hacer `git push`

- Los cambios **sí están guardados** en tu carpeta (y si hiciste commit, en tu disco local).  
- Cuando tengas una red que resuelva GitHub, vuelve a ejecutar **`HAZLO-AUTOMATICO.bat`**.

## Alternativa

Subir cambios desde **otro PC o red** donde `git push` funcione (clonar el mismo repo, copiar archivos, push).
