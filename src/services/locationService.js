import axios from 'axios';

export const validateAddress = async (address) => {
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address + ", Cordoba, Argentina")}&format=json&addressdetails=1&limit=1`;
        console.log(url)
        const response = await axios.get(url, {
            headers: { 'User-Agent': 'DonPepeBot/1.0' } // Nominatim lo pide obligatoriamente
        });

        if (response.data.length > 0) {
            const result = response.data[0];
            
            // Verificación más robusta: buscamos "Córdoba" en ciudad, municipio o estado
            const addr = result.address;
            const isCordoba = 
                (addr.city === "Córdoba" || addr.town === "Córdoba" || addr.suburb === "Córdoba") ||
                (addr.state === "Córdoba" && (addr.city === "Capital" || addr.county === "Capital"));

            if (!isCordoba) {
                return { isValid: false, error: "Solo entregamos en Córdoba Capital" };
            }

            return {
                isValid: true,
                formattedAddress: result.display_name,
                coords: { lat: result.lat, lng: result.lon }
            };
        }
        return { isValid: false, error: "No encontré esa calle, che." };
    } catch (error) {
        return { isValid: false, error: "Error en el servidor de mapas" };
    }
}