import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Globe, MapPin } from "lucide-react";

export default function SubscriptionSelector() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-8 py-12 px-4">
        <div className="text-center space-y-4">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Globe className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-heading font-bold tracking-tight">Select Your Region</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose your billing region to see available plans and pricing in your local currency.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 mt-12 max-w-3xl mx-auto">
          <Link href="/subscription/uae" className="group block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl">
            <Card className="h-full border-2 transition-all duration-200 hover:border-primary hover:shadow-md group-hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto bg-blue-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-blue-500/20 transition-colors">
                  <MapPin className="h-6 w-6 text-blue-600" />
                </div>
                <CardTitle className="text-2xl font-bold">United Arab Emirates</CardTitle>
                <CardDescription className="text-base mt-2">Billing in AED (Dirhams)</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full text-base h-12" variant="default">Select UAE</Button>
              </CardContent>
            </Card>
          </Link>
          
          <Link href="/subscription/ph" className="group block focus:outline-none focus:ring-2 focus:ring-primary rounded-xl">
            <Card className="h-full border-2 transition-all duration-200 hover:border-primary hover:shadow-md group-hover:-translate-y-1">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto bg-amber-500/10 w-12 h-12 rounded-full flex items-center justify-center mb-4 group-hover:bg-amber-500/20 transition-colors">
                  <MapPin className="h-6 w-6 text-amber-600" />
                </div>
                <CardTitle className="text-2xl font-bold">Philippines</CardTitle>
                <CardDescription className="text-base mt-2">Billing in PHP (Pesos)</CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full text-base h-12" variant="default">Select Philippines</Button>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </Layout>
  );
}