import  prisma from "../utils/prisma.js";

export const getBusinessStatus = async (tenantId)=>{
    const now = new Date();
    const argentinaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));

    const todayDate = new Date(argentinaTime.getFullYear(), argentinaTime.getMonth(), argentinaTime.getDate());
    
    const currentTime = argentinaTime.getHours().toString().padStart(2, '0') + ':' +
                        argentinaTime.getMinutes().toString().padStart(2, '0')

    console.log(`Chequeando estado para ${tenantId} a las ${currentTime}`);

    const specialDate = await prisma.specialDate.findFirst({
        where: {
            tenantId,
            date: todayDate
        }
    });

    if(specialDate) {
        console.log("Fecha especial detectada: ", specialDate.comment);
        if(!specialDate.isOpen) return {isOpen: false, message: specialDate.comment || "Cerrado por feriado"}

        const open = specialDate.openTime || "00:00";
        const close = specialDate.closeTime || "23:59";
        const isOpen = currentTime >= open && currentTime <= close;
        return {
            isOpen,
            message: isOpen ? "Abierto (horario especial)" : "Cerrado (horario especial)"
        }
    }

    const dayOfWeek = argentinaTime.getDay();
    const schedule = await prisma.businessHour.findUnique({
        where: { tenantId_dayOfWeek: {tenantId, dayOfWeek}}
    })

    if(!schedule) {
        return {isOpen: false, message: "Hoy no habrimos"}
    }

    const isOpen = currentTime >= schedule.openTime && currentTime <= schedule.closeTime;

    return {
        isOpen,
        message: isOpen ? "Estamos abiertos" : `Abrimos de ${schedule.openTime} a ${schedule.closeTime}`
    }
}