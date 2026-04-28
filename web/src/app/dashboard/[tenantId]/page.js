'use client'
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart, Users, DollarSign, Clock } from "lucide-react"
import { useState } from "react"

export default function Dashboard() {
  const params = useParams()
  const tenantId = params.tenantId
  const { data: orders, isLoading, isError } = useQuery({
    queryKey: ['orders', tenantId],
    queryFn: () => fetch(`http://localhost:3000/api/web/orders/${tenantId}`).then(res => res.json()),
    enabled: !!tenantId,
    refetchInterval: 30000
  });

  const totalSales = orders?.reduce((acc, order)=> acc + Number(order.totalAmount), 0) || 0;
  const pendingOrders = orders?.filter(order => order.status === 'PENDING').length || 0;
  const averageTicket = orders?.length ? totalSales / orders?.length : 0;

  const [selectedfilter, setSelectedfilter] = useState("ALL");
    const filtredOrders = orders?.filter((order)=>{
    if(selectedfilter === "ALL") return true
    return order.status === selectedfilter
  })
  // Solo esto se muestra mientras carga
  if (isLoading) return <div className="p-8 text-center font-bold">Cargando pedidos de Don Pepe...</div>;
  if (isError) return <div className="p-8 text-red-500">Error al conectar con el servidor.</div>;

  return (
    <div className="p-8 bg-slate-50 min-h-screen space-y-8">
      <h1 className="text-2xl font-bold">Panel de Control</h1>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total de Ventas</CardTitle>
          <DollarSign className="h-4 w-4 text-green-600"></DollarSign>
        </CardHeader>
        <CardContent>
          {totalSales}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader><CardTitle>Últimos Pedidos por WhatsApp</CardTitle></CardHeader>
        <CardContent>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mr-5"
            onClick={() =>setSelectedfilter('ALL')}>Todos
          </button>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            onClick={() =>setSelectedfilter('PENDING')}>Pendiente
          </button>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtredOrders?.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">
                    {order.customerName || "Cliente sin nombre"} 
                    <span className="block text-xs text-slate-400">{order.customerPhone}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.status === 'PENDING' ? 'outline' : 'default'}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{order.deliveryMethod}</TableCell>
                  <TableCell className="text-right font-bold">
                    ${Number(order.totalAmount).toLocaleString()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}