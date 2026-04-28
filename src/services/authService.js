import bcrypt from "bcrypt";
import prisma from "../utils/prisma.js";
import jwt from "jsonwebtoken";

const register = async (req, res) => {
    const { email, password, businessName } = req.body;
    console.log("Registering user with email:", email, "and business name:", businessName);

    if (!email || !password || !businessName) {
        return res.status(400).json({ error: "Email, password and business name are required" });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: "Password must be at least 6 characters long" });
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
    }

    const existingUser = await prisma.user.findUnique({
            where: { email },
        });
        if (existingUser) {
            return res.status(400).json({ error: "Email already in use" });
        }

    try {
        const passwordHashed = await bcrypt.hash(password, 10);

        const result = await prisma.$transaction(async (tx)=>{

            const newTenant = await tx.tenant.create({
                data: {
                    businessName: businessName,
                },
            });

            console.log("New tenant created:", newTenant)

            const newUser = await tx.user.create({
                data: {
                    email,
                    password: passwordHashed,
                    tenantId: newTenant.id,
                    role: "admin",
                },

            });

            return { newTenant, newUser };
        });
        
        res.status(201).json({ message: "SaaS tenant and admin created successfully", data: result });

    }catch (error) {
        console.error("Error registering user:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    try {
        const user = await prisma.user.findUnique({
            where: { email },
        });
        if (!user) {
            return res.status(404).json({ error: "Invalid credentials" });
        }
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id, tenantId: user.tenantId, role: user.role }, process.env.JWT_SECRET, { expiresIn: "8h" });
        res.json({ token });

    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ error: "Internal server error" });
    }
}
export default { register, login };