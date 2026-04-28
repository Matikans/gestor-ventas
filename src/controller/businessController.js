import prisma from "../utils/prisma.js";

export const getBusinessHours = async (req, res) => {
    try{
        const {tenantId} = req.user;
        const hours = await prisma.businessHour.findMany({
            where: {tenantId},
            orderBy: {dayOfWeek: 'asc'}
        });
        res.json(hours);
    }catch(error){
        console.error('Error fetching business hours:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const updateBusinessHours = async (req, res) => {
    try {
        const {tenantId} = req.user;
        const { dayOfWeek, openTime, closeTime } = req.body;

        const updatedHour = await prisma.businessHour.upsert({
            where: { tenantId_dayOfWeek: {tenantId, dayOfWeek: parseInt(dayOfWeek)} },
            update: { openTime, closeTime },
            create: { tenantId, dayOfWeek: parseInt(dayOfWeek), openTime, closeTime },
        });

        res.json(updatedHour);

    }catch(error){
        console.error('Error updating business hours:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const createSpecialDate = async (req, res) => {
    try {
        const {tenantId} = req.user;
        const { date, isOpen, openTime, closeTime, comment} = req.body;

        const newSpecialDate = await prisma.specialDate.create({
            data: {
                date: new Date(date),
                isOpen,
                openTime,
                closeTime,
                comment,
                tenantId
            }
        });

        res.json(newSpecialDate);
    }catch(error){
        console.error('Error creating special date:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const getApiConfig = async (req, res) => {
    try{
        const { tenantId } = req.user;
        const config = await prisma.apiConfig.findFirst({
            where: { tenantId},
            include: {tenant: true}
        });
        res.json(config);
    }catch(error){
        console.error('Error fetching API config:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const updateApiConfig = async (req, res) => {
    try {
        const { tenantId } = req.user;
        const { paymentPrivateKey, paymentPublicKey, whatsappToken } = req.body;

        const updatedConfig = await prisma.apiConfig.update({
            where: { tenantId },
            data: {paymentPrivateKey, paymentPublicKey, whatsappToken}
        });
        res.json(updatedConfig);
    }catch(error){
        console.error('Error updating API config:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const getOrders = async (req, res) => {
    try {
        const { tenantId } = req.user;
        const orders = await prisma.order.findMany({
            where: {tenantId},
            orderBy: {createdAt: 'desc'},
            include: {
                items: true
            }
        });
        res.json(orders);
    }catch(error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

